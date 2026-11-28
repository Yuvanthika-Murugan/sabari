<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** Office expenses (EXP…), including cash handed over to agents. */
final class Expense extends Model
{
    protected const TABLE = 'expenses';
    protected const LABEL = 'Expense';
    protected const SELECT = "SELECT CAST(e.id AS CHAR) AS id, e.expense_no AS expenseNo, DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS date,
        e.category, e.amount, e.payment_mode AS paymentMode,
        COALESCE(CAST(e.agent_id AS CHAR), '') AS agentId, COALESCE(a.name, '') AS agentName,
        COALESCE(CAST(e.staff_id AS CHAR), '') AS staffId, COALESCE(s.name, '') AS staffName,
        e.remarks, COALESCE(u.name, '-') AS createdBy
        FROM expenses e
        LEFT JOIN agents a ON a.id = e.agent_id
        LEFT JOIN users s ON s.id = e.staff_id
        LEFT JOIN users u ON u.id = e.created_by";

    /** Expenses a collection staff member entered or that are booked to them. */
    public static function forStaff(int $userId): array
    {
        return self::query('(e.staff_id = ? OR e.created_by = ?)', [$userId, $userId]);
    }
    protected const KEY = 'e.id';
    protected const ORDER = ' ORDER BY e.expense_date DESC, e.id DESC';
    protected const FLOATS = ['amount'];

    /** Total expenses, optionally for one payment mode ('cash' or 'bank'). */
    public static function total(?string $mode = null): float
    {
        return $mode === null
            ? (float) DB::value('SELECT COALESCE(SUM(amount), 0) FROM expenses')
            : (float) DB::value('SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE payment_mode = ?', [$mode]);
    }
}
