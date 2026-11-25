<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Auth;
use App\Core\HttpException;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\CashTransaction;
use App\Models\Collection;
use App\Models\Customer;
use App\Models\DayEndClosing;
use App\Models\DueSchedule;

/** Posts money movements: customer dues, receipts, cash book and bank book. */
final class Ledger
{
    public static function assertDayOpen(string $date): void
    {
        if (DayEndClosing::isClosed($date)) {
            throw HttpException::unprocessable("The day $date is already closed. Entries for closed days are locked.");
        }
    }

    public static function cashBalance(): float
    {
        return CashTransaction::balance();
    }

    public static function cash(string $date, string $ref, string $description, float $debit, float $credit, string $type): void
    {
        CashTransaction::post($date, $ref, $description, $debit, $credit, $type);
    }

    public static function bank(int $accountId, string $date, string $description, float $credit, float $debit, string $type): void
    {
        $balance = BankAccount::balanceForUpdate($accountId) ?? throw HttpException::unprocessable('Bank account not found');
        $newBalance = $balance + $credit - $debit;
        BankTransaction::create([
            'account_id' => $accountId,
            'txn_date' => $date,
            'transaction_ref' => BankTransaction::nextCode('transaction_ref', 'TXN', 10),
            'description' => $description,
            'credit' => $credit,
            'debit' => $debit,
            'balance' => $newBalance,
            'type' => $type,
        ]);
        BankAccount::update($accountId, ['current_balance' => $newBalance]);
    }

    /**
     * Records a customer collection: applies the amount to the customer's dues
     * (starting at $dueNumber, or the oldest unpaid due), issues a receipt, and
     * posts cash collections to the cash book. Returns the receipt number.
     *
     * A "chit" receipt is a regular installment. An "arrear" receipt may only
     * be applied to dues that fell due before $date.
     */
    public static function collect(int $customerId, ?int $dueNumber, float $amount, string $mode, string $reference, string $date, string $time, string $remarks, string $type = 'chit'): string
    {
        self::assertDayOpen($date);

        $customer = Customer::record($customerId) ?? throw HttpException::unprocessable('Customer not found');

        $dues = DueSchedule::unpaidForUpdate($customerId);
        if ($dueNumber !== null) {
            $dues = array_values(array_filter($dues, fn ($d) => (int) $d['due_number'] >= $dueNumber));
        }
        if ($type === 'arrear') {
            $dues = array_values(array_filter($dues, fn ($d) => $d['due_date'] < $date));
            if (!$dues) {
                throw HttpException::unprocessable('This customer has no arrears. Use a chit receipt instead.');
            }
        }
        if (!$dues) {
            throw HttpException::unprocessable('This customer has no pending dues to collect against');
        }
        $outstanding = array_sum(array_map(fn ($d) => $d['due_amount'] - $d['paid_amount'], $dues));
        if ($amount > $outstanding + 0.001) {
            $label = $type === 'arrear' ? 'arrear balance' : 'outstanding balance';
            throw HttpException::unprocessable("Amount exceeds the $label of " . Audit::money($outstanding));
        }

        $first = $dues[0];
        $remaining = $amount;
        foreach ($dues as $due) {
            if ($remaining <= 0) {
                break;
            }
            $apply = min($remaining, $due['due_amount'] - $due['paid_amount']);
            DueSchedule::addPayment((int) $due['id'], $apply, $date);
            $remaining -= $apply;
        }

        $receipt = Collection::nextCode('receipt_no', $type === 'arrear' ? 'ARR' : 'RCP', 6);
        Collection::create([
            'receipt_no' => $receipt,
            'receipt_type' => $type,
            'customer_id' => $customerId,
            'group_id' => $customer['group_id'],
            'branch_id' => $customer['branch_id'],
            'staff_id' => Auth::is('staff') ? Auth::id() : $customer['staff_id'],
            'due_number' => $first['due_number'],
            'due_amount' => $first['due_amount'],
            'collected_amount' => $amount,
            'pending_amount' => max(0, $first['due_amount'] - $first['paid_amount'] - $amount),
            'payment_mode' => $mode,
            'reference_no' => $reference,
            'collection_date' => $date,
            'collection_time' => $time,
            'remarks' => $remarks,
            'status' => 'completed',
            'created_by' => Auth::id(),
        ]);

        if ($mode === 'cash') {
            $label = $type === 'arrear' ? 'Arrear collection' : 'Collection';
            self::cash($date, $receipt, "$label - {$customer['name']}", 0, $amount, 'collection');
        }

        Audit::log($type === 'arrear' ? 'Arrear Receipt Entered' : 'Collection Entered', 'Collections', $receipt, '-', Audit::money($amount));
        return $receipt;
    }

    /**
     * Cancels a receipt: takes its amount back off the customer's dues (latest
     * installments first) and, for cash, posts a reversing entry to the cash book
     * on $date. Callers must ensure it is the customer's latest receipt.
     */
    public static function reverseReceipt(array $receipt, string $reason, string $date): void
    {
        $remaining = (float) $receipt['collected_amount'];
        foreach (DueSchedule::paidForUpdate((int) $receipt['customer_id']) as $due) {
            if ($remaining <= 0.001) {
                break;
            }
            $take = min($remaining, (float) $due['paid_amount']);
            DueSchedule::removePayment((int) $due['id'], $take);
            $remaining -= $take;
        }

        if ($receipt['payment_mode'] === 'cash') {
            self::cash($date, $receipt['receipt_no'], "Cancelled receipt - {$receipt['name']}", (float) $receipt['collected_amount'], 0, 'collection');
        }
        Collection::update((int) $receipt['id'], [
            'status' => 'rejected',
            'cancel_reason' => $reason,
            'cancelled_by' => Auth::id(),
            'cancelled_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Reduces a member's dues by an auction dividend, starting at the auctioned
     * installment. Any part a due cannot absorb (because it is already paid)
     * carries to the following unpaid dues.
     */
    public static function applyDividend(int $customerId, int $fromDue, float $amount): void
    {
        foreach (DueSchedule::unpaidForUpdate($customerId, $fromDue) as $due) {
            if ($amount <= 0) {
                break;
            }
            $cut = min($amount, $due['due_amount'] - $due['paid_amount']);
            DueSchedule::reduceDue((int) $due['id'], $cut);
            $amount -= $cut;
        }
    }
}
