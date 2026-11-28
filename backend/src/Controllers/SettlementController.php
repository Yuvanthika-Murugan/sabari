<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\BankAccount;
use App\Models\ChitSettlement;
use App\Models\Customer;
use App\Services\Audit;
use App\Services\Ledger;
use App\Services\Notifier;
use App\Services\Visibility;

/**
 * Chit settlement (payout) for a customer whose chit is finishing:
 *  1. the collection staff / agent of the customer (or the office) requests it, once all
 *     instalments are paid or from the day before the customer's last instalment;
 *  2. the Super Admin (MD) approves it (and may correct the amount) or rejects it;
 *  3. the Admin pays it out by cash, bank transfer or cheque, which is booked in the
 *     cash / bank book like a prize payout.
 */
final class SettlementController
{
    public static function visible(): array
    {
        return Visibility::office() ? ChitSettlement::all() : ChitSettlement::forStaff(Auth::id());
    }

    public static function index(Request $req): array
    {
        return self::visible();
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager', 'staff');
        $in = $req->input();
        $customerId = $in->id('customerId', true);
        $note = $in->str('note', false, 255);
        $in->validate();

        $customer = Customer::find($customerId);
        if (Auth::is('staff')) {
            $mine = (int) $customer['staffId'] === Auth::id()
                || ($customer['agentId'] !== '' && (int) DB::value('SELECT user_id FROM agents WHERE id = ?', [(int) $customer['agentId']]) === Auth::id());
            if (!$mine) {
                throw new HttpException(403, 'You can request a settlement only for your own customers');
            }
        }
        $groupId = (int) $customer['groupId'];
        $group = DB::one('SELECT id, group_value, group_name FROM chit_groups WHERE id = ?', [$groupId])
            ?? throw HttpException::unprocessable('This customer is not in a chit group');

        $open = DB::value("SELECT settlement_no FROM chit_settlements WHERE customer_id = ? AND group_id = ? AND status IN ('requested','approved','paid')", [$customerId, $groupId]);
        if ($open) {
            throw HttpException::unprocessable("A settlement ($open) already exists for this customer's chit");
        }
        $won = DB::value('SELECT auction_no FROM auctions WHERE customer_id = ? AND group_id = ? LIMIT 1', [$customerId, $groupId]);
        if ($won) {
            throw HttpException::unprocessable("This customer already took the prize in auction #$won, so there is no settlement to pay");
        }
        // Allowed once every instalment is paid, or from the day before the last instalment.
        $finalDue = (string) DB::value('SELECT MAX(due_date) FROM due_schedules WHERE customer_id = ? AND group_id = ?', [$customerId, $groupId]);
        $unpaid = (int) DB::value('SELECT COUNT(*) FROM due_schedules WHERE customer_id = ? AND group_id = ? AND paid_amount < due_amount', [$customerId, $groupId]);
        $from = $finalDue ? date('Y-m-d', strtotime($finalDue . ' -1 day')) : '';
        if ($finalDue === '' || ($unpaid > 0 && date('Y-m-d') < $from)) {
            throw HttpException::unprocessable('The settlement can be requested once all instalments are paid, or from ' . ($from ?: '-') . ' (the day before the last instalment, ' . ($finalDue ?: '-') . ')');
        }

        $id = DB::transaction(function () use ($customerId, $groupId, $group, $note, $customer) {
            $number = ChitSettlement::nextCode('settlement_no', 'SET', 6);
            $id = ChitSettlement::create([
                'settlement_no' => $number, 'customer_id' => $customerId, 'group_id' => $groupId,
                'amount' => (float) $group['group_value'], 'status' => 'requested', 'request_note' => $note,
                'requested_by' => Auth::id(), 'requested_at' => date('Y-m-d H:i:s'),
            ]);
            Audit::log('Settlement Requested', 'Settlements', $number, '-', "{$customer['name']} · " . Audit::money((float) $group['group_value']));
            Notifier::push('md_approval', 'Chit settlement to approve',
                "$number: {$customer['name']} ({$group['group_name']}) " . Audit::money((float) $group['group_value']) . ' requested by ' . Auth::user()['name']);
            return $id;
        });
        return ChitSettlement::find($id);
    }

    /** Super Admin (MD) only: approve (optionally with a corrected amount) or reject. */
    public static function decide(Request $req, int $id): array
    {
        Auth::requireRole('md');
        $s = ChitSettlement::find($id);
        if ($s['status'] !== 'requested') {
            throw HttpException::unprocessable('This settlement has already been ' . $s['status']);
        }
        $in = $req->input();
        $action = $in->enum('action', ['approve', 'reject']);
        $amount = $action === 'approve' ? ($in->num('amount', false, 1, null) ?? $s['amount']) : $s['amount'];
        $note = $in->str('note', $action === 'reject', 255);
        $in->validate();

        $status = $action === 'approve' ? 'approved' : 'rejected';
        ChitSettlement::update($id, [
            'status' => $status, 'amount' => $amount, 'decision_note' => $note,
            'decided_by' => Auth::id(), 'decided_at' => date('Y-m-d H:i:s'),
        ]);
        Audit::log($action === 'approve' ? 'Settlement Approved' : 'Settlement Rejected', 'Settlements', $s['settlementNo'],
            Audit::money($s['amount']), $action === 'approve' ? Audit::money($amount) : $note);
        Notifier::push($action === 'approve' ? 'payment_approved' : 'payment_rejected',
            $action === 'approve' ? 'Chit settlement approved — pay out' : 'Chit settlement rejected',
            "{$s['settlementNo']}: {$s['customerName']} " . Audit::money($amount) . ($note !== '' ? " · $note" : ''));
        return ChitSettlement::find($id);
    }

    /** Admin / MD: pay out an approved settlement by cash, bank transfer or cheque. */
    public static function pay(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $s = ChitSettlement::find($id);
        if ($s['status'] !== 'approved') {
            throw HttpException::unprocessable($s['status'] === 'paid' ? 'This settlement has already been paid' : 'Only a settlement approved by the Super Admin can be paid');
        }
        $in = $req->input();
        $mode = $in->enum('payoutMode', ['cash', 'bank_transfer', 'cheque']);
        $accountId = $in->id('bankAccountId', $mode !== null && $mode !== 'cash');
        $reference = $in->reference('payoutReference', $mode !== null && $mode !== 'cash');
        $date = $in->date('paidDate', false, date('Y-m-d'));
        if ($mode === 'cash' && Ledger::cashBalance() < $s['amount']) {
            $in->error('payoutMode', 'Cash in hand (' . Audit::money(Ledger::cashBalance()) . ') is less than the settlement. Pay by bank or cheque.');
        } elseif ($accountId !== null) {
            $balance = BankAccount::activeBalance($accountId);
            if ($balance === null) {
                $in->error('bankAccountId', 'Choose an active bank account');
            } elseif ($balance < $s['amount']) {
                $in->error('bankAccountId', 'This account\'s balance (' . Audit::money($balance) . ') is less than the settlement');
            }
        }
        $in->validate();
        Ledger::assertDayOpen($date);

        DB::transaction(function () use ($s, $id, $mode, $accountId, $reference, $date) {
            $description = "Chit settlement {$s['settlementNo']} - {$s['customerName']} ({$s['groupName']})";
            if ($mode === 'cash') {
                Ledger::cash($date, $s['settlementNo'], $description, $s['amount'], 0, 'payment');
            } else {
                Ledger::bank($accountId, $date, $description, 0, $s['amount'], 'withdrawal');
            }
            ChitSettlement::update($id, [
                'status' => 'paid', 'payout_mode' => $mode, 'bank_account_id' => $mode === 'cash' ? null : $accountId,
                'payout_reference' => $reference, 'paid_date' => $date, 'paid_by' => Auth::id(),
            ]);
            Audit::log('Settlement Paid', 'Settlements', $s['settlementNo'], 'approved', Audit::money($s['amount']) . " ($mode)");
        });
        return ChitSettlement::find($id);
    }
}
