<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/**
 * Day-end reconciliation, one row per day. Open days are recalculated from the
 * books whenever they are read; closing a day freezes its figures.
 */
final class DayEndClosing extends Model
{
    protected const TABLE = 'day_end_closings';
    protected const LABEL = 'Day';
    protected const SELECT = "SELECT CAST(d.id AS CHAR) AS id, DATE_FORMAT(d.closing_date, '%Y-%m-%d') AS date,
        d.opening_cash AS openingCash, d.cash_collection AS cashCollection, d.other_cash_receipt AS otherCashReceipt,
        d.expenses, d.withdrawals, d.expected_closing_cash AS expectedClosingCash, d.physical_cash AS physicalCash,
        d.difference, d.bank_credits AS bankCredits, d.bank_debits AS bankDebits, d.upi_collection AS upiCollection,
        d.total_collection AS totalCollection, d.pending_approvals AS pendingApprovals,
        d.rejected_transactions AS rejectedTransactions, d.status, u.name AS closedBy,
        DATE_FORMAT(d.closed_at, '%H:%i') AS closedTime, d.remarks
        FROM day_end_closings d LEFT JOIN users u ON u.id = d.closed_by";
    protected const KEY = 'd.id';
    protected const ORDER = ' ORDER BY d.closing_date DESC';
    protected const FLOATS = ['openingCash', 'cashCollection', 'otherCashReceipt', 'expenses', 'withdrawals', 'expectedClosingCash',
        'physicalCash', 'difference', 'bankCredits', 'bankDebits', 'upiCollection', 'totalCollection'];
    protected const INTS = ['pendingApprovals', 'rejectedTransactions'];

    /** All days, newest first, with open days brought up to date. */
    public static function all(): array
    {
        self::sync();
        return parent::all();
    }

    public static function isClosed(string $date): bool
    {
        return self::exists("closing_date = ? AND status = 'closed'", [$date]);
    }

    /** Ensures a row exists for every day up to today, then recalculates open days. */
    public static function sync(): void
    {
        $today = date('Y-m-d');
        $last = DB::value('SELECT MAX(closing_date) FROM day_end_closings');
        $start = $last ? date('Y-m-d', strtotime("$last +1 day")) : date('Y-m-d', strtotime('-2 days'));
        $start = max($start, date('Y-m-d', strtotime('-31 days')));
        for ($d = $start; $d <= $today; $d = date('Y-m-d', strtotime("$d +1 day"))) {
            DB::exec('INSERT IGNORE INTO day_end_closings (closing_date) VALUES (?)', [$d]);
        }

        foreach (DB::all("SELECT id, closing_date FROM day_end_closings WHERE status = 'open'") as $row) {
            self::update((int) $row['id'], self::figures($row['closing_date']));
        }
    }

    /** The day's figures, computed from the cash book, bank book, receipts and payments. */
    private static function figures(string $date): array
    {
        $opening = CashTransaction::balance($date);
        $cash = CashTransaction::totalsOn($date);
        $col = Collection::totalsOn($date);
        $col['cash'] -= $cash['reversals'];
        $bank = BankTransaction::totalsOn($date);

        $expected = $opening + $col['cash'] + $cash['receipts'] - $cash['expenses'] - $cash['withdrawals'];
        return [
            'opening_cash' => $opening,
            'cash_collection' => $col['cash'],
            'other_cash_receipt' => $cash['receipts'],
            'expenses' => $cash['expenses'],
            'withdrawals' => $cash['withdrawals'],
            'expected_closing_cash' => $expected,
            'bank_credits' => $bank['credits'],
            'bank_debits' => $bank['debits'],
            'upi_collection' => $col['upi'],
            'total_collection' => $col['total'],
            'pending_approvals' => Payment::awaitingCount($date),
            'rejected_transactions' => Payment::rejectedOn($date),
        ];
    }
}
