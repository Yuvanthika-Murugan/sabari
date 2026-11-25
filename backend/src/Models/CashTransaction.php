<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** The cash book. Each row stores the running balance after it. */
final class CashTransaction extends Model
{
    protected const TABLE = 'cash_transactions';
    protected const SELECT = "SELECT CAST(id AS CHAR) AS id, DATE_FORMAT(txn_date, '%Y-%m-%d') AS date, voucher_receipt AS voucherReceipt,
        description, debit, credit, balance, type
        FROM cash_transactions";
    protected const ORDER = ' ORDER BY txn_date, id';
    protected const FLOATS = ['debit', 'credit', 'balance'];

    /** Cash in hand now (or at the end of the day before $before). */
    public static function balance(?string $before = null): float
    {
        return $before === null
            ? (float) (DB::value('SELECT balance FROM cash_transactions ORDER BY txn_date DESC, id DESC LIMIT 1') ?? 0)
            : (float) (DB::value('SELECT balance FROM cash_transactions WHERE txn_date < ? ORDER BY txn_date DESC, id DESC LIMIT 1', [$before]) ?? 0);
    }

    /** Appends an entry and its running balance. */
    public static function post(string $date, string $ref, string $description, float $debit, float $credit, string $type): void
    {
        self::create([
            'txn_date' => $date,
            'voucher_receipt' => $ref,
            'description' => $description,
            'debit' => $debit,
            'credit' => $credit,
            'balance' => self::balance() + $credit - $debit,
            'type' => $type,
        ]);
    }

    /** A day's cash receipts, expenses/payments, withdrawals and receipt reversals. */
    public static function totalsOn(string $date): array
    {
        return DB::one(
            "SELECT COALESCE(SUM(CASE WHEN type = 'receipt' THEN credit END), 0) AS receipts,
                    COALESCE(SUM(CASE WHEN type IN ('expense','payment') THEN debit END), 0) AS expenses,
                    COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN debit END), 0) AS withdrawals,
                    COALESCE(SUM(CASE WHEN type = 'collection' THEN debit END), 0) AS reversals
             FROM cash_transactions WHERE txn_date = ?",
            [$date]
        );
    }
}
