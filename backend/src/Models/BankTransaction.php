<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** The bank book. Each row stores the account's balance after it. */
final class BankTransaction extends Model
{
    protected const TABLE = 'bank_transactions';
    protected const SELECT = "SELECT CAST(id AS CHAR) AS id, CAST(account_id AS CHAR) AS accountId, DATE_FORMAT(txn_date, '%Y-%m-%d') AS date,
        transaction_ref AS transactionId, description, credit, debit, balance, type
        FROM bank_transactions";
    protected const ORDER = ' ORDER BY txn_date DESC, id DESC';
    protected const FLOATS = ['credit', 'debit', 'balance'];

    public static function existsFor(int $accountId): bool
    {
        return self::exists('account_id = ?', [$accountId]);
    }

    /** A day's total credits and debits across all accounts. */
    public static function totalsOn(string $date): array
    {
        return DB::one('SELECT COALESCE(SUM(credit), 0) AS credits, COALESCE(SUM(debit), 0) AS debits FROM bank_transactions WHERE txn_date = ?', [$date]);
    }
}
