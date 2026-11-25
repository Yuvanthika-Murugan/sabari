<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\Withdrawal;
use App\Services\Audit;
use App\Services\Ledger;
use App\Services\Visibility;

final class WithdrawalController
{
    public static function index(Request $req): array
    {
        return Visibility::officeOnly(Withdrawal::all());
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $in = $req->input();
        $date = $in->date('date', false, date('Y-m-d'));
        $accountId = $in->id('accountId', true);
        $amount = $in->num('amount', true, 1);
        $mode = $in->enum('mode', ['bank_transfer', 'cheque', 'cash']);
        $reference = $in->reference('reference');
        $reason = $in->str('reason', true);
        $in->validate();

        $code = DB::transaction(function () use ($date, $accountId, $amount, $mode, $reference, $reason) {
            $code = Withdrawal::nextCode('withdrawal_code', 'WDL', 5);
            Withdrawal::create([
                'withdrawal_code' => $code,
                'withdrawal_date' => $date,
                'bank_account_id' => $accountId,
                'amount' => $amount,
                'mode' => $mode,
                'reference' => $reference,
                'reason' => $reason,
                'requested_by' => Auth::id(),
            ]);
            Audit::log('Withdrawal Requested', 'Withdrawals', $code, '-', Audit::money($amount));
            return $code;
        });
        return ['withdrawalId' => $code];
    }

    /** MD approves or rejects; approval debits the bank account. */
    public static function decide(Request $req, int $id): array
    {
        Auth::requireRole('md');
        $in = $req->input();
        $decision = $in->enum('decision', ['approved', 'rejected']);
        $in->validate();

        $w = Withdrawal::recordOrFail($id);
        if ($w['status'] !== 'pending') {
            throw HttpException::unprocessable('This withdrawal has already been ' . $w['status']);
        }

        DB::transaction(function () use ($w, $id, $decision) {
            Withdrawal::update($id, ['status' => $decision, 'approved_by' => Auth::id()]);
            if ($decision === 'approved' && $w['bank_account_id']) {
                Ledger::bank((int) $w['bank_account_id'], date('Y-m-d'), "Withdrawal {$w['withdrawal_code']} - {$w['reason']}", 0, (float) $w['amount'], 'withdrawal');
            }
            Audit::log($decision === 'approved' ? 'Withdrawal Approved' : 'Withdrawal Rejected', 'Withdrawals', $w['withdrawal_code'], 'pending', $decision);
        });
        return ['ok' => true];
    }
}
