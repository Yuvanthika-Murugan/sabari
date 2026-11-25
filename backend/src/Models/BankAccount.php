<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

final class BankAccount extends Model
{
    protected const TABLE = 'bank_accounts';
    protected const LABEL = 'Bank account';
    protected const SELECT = "SELECT CAST(id AS CHAR) AS id, bank_name AS bankName, account_name AS accountName, account_number AS accountNumber,
        branch, ifsc, opening_balance AS openingBalance, current_balance AS currentBalance, status
        FROM bank_accounts";
    protected const ORDER = ' ORDER BY id';
    protected const FLOATS = ['openingBalance', 'currentBalance'];

    public static function numberTaken(string $number, int $ignoreId = 0): bool
    {
        return self::exists('account_number = ? AND id <> ?', [$number, $ignoreId]);
    }

    /** Balance of an active account, or null if there is no such active account. */
    public static function activeBalance(int $id): ?float
    {
        $balance = DB::value("SELECT current_balance FROM bank_accounts WHERE id = ? AND status = 'active'", [$id]);
        return $balance === null ? null : (float) $balance;
    }

    /** Current balance, locked for the rest of the transaction; null if the account does not exist. */
    public static function balanceForUpdate(int $id): ?float
    {
        $balance = DB::value('SELECT current_balance FROM bank_accounts WHERE id = ? FOR UPDATE', [$id]);
        return $balance === null ? null : (float) $balance;
    }

    public static function totalActiveBalance(): float
    {
        return (float) DB::value("SELECT COALESCE(SUM(current_balance), 0) FROM bank_accounts WHERE status = 'active'");
    }
}
