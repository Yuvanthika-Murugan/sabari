<?php

declare(strict_types=1);

namespace App\Models;

final class Withdrawal extends Model
{
    protected const TABLE = 'withdrawals';
    protected const LABEL = 'Withdrawal';
    protected const SELECT = "SELECT CAST(w.id AS CHAR) AS id, w.withdrawal_code AS withdrawalId, DATE_FORMAT(w.withdrawal_date, '%Y-%m-%d') AS date,
        COALESCE(a.bank_name, 'Cash') AS account, COALESCE(CAST(w.bank_account_id AS CHAR), '') AS accountId,
        w.amount, w.mode, w.reference, w.reason,
        COALESCE(r.name, '-') AS requestedBy, ap.name AS approvedBy, w.status
        FROM withdrawals w
        LEFT JOIN bank_accounts a ON a.id = w.bank_account_id
        LEFT JOIN users r ON r.id = w.requested_by
        LEFT JOIN users ap ON ap.id = w.approved_by";
    protected const KEY = 'w.id';
    protected const ORDER = ' ORDER BY w.withdrawal_date DESC, w.id DESC';
    protected const FLOATS = ['amount'];
}
