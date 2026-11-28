<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** Read-only figures for the dashboard, aggregated across tables. */
final class DashboardReport
{
    public static function data(): array
    {
        $collected = fn (string $where) => Collection::sumWhere($where);
        $today = $collected('collection_date = CURDATE()');
        $yesterday = $collected('collection_date = CURDATE() - INTERVAL 1 DAY');
        $thisMonth = $collected("collection_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
        $lastMonthToDate = $collected(
            "collection_date >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01') AND collection_date <= CURDATE() - INTERVAL 1 MONTH"
        );

        // Total Cash / Total Bank: money received by mode, less the expenses paid from it.
        $cashCollected = $collected("payment_mode = 'cash'");
        $bankCollected = $collected("payment_mode <> 'cash'");
        $cashExpense = Expense::total('cash');
        $bankExpense = Expense::total('bank');

        $stats = [
            'cashCollected' => $cashCollected,
            'bankCollected' => $bankCollected,
            'cashExpense' => $cashExpense,
            'bankExpense' => $bankExpense,
            'expenseTotal' => $cashExpense + $bankExpense,
            'todayExpense' => (float) DB::value('SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE expense_date = CURDATE()'),
            'totalCash' => $cashCollected - $cashExpense,
            'totalBank' => $bankCollected - $bankExpense,
            'todayCollection' => $today,
            'todayChange' => self::change($today, $yesterday),
            'thisMonthCollection' => $thisMonth,
            'monthChange' => self::change($thisMonth, $lastMonthToDate),
            'totalCollection' => $collected('1 = 1'),
            'todayPending' => (float) DB::value('SELECT COALESCE(SUM(due_amount - paid_amount), 0) FROM due_schedules WHERE due_date <= CURDATE()'),
            'totalPending' => (float) DB::value('SELECT COALESCE(SUM(due_amount - paid_amount), 0) FROM due_schedules'),
            'cashBalance' => CashTransaction::balance(),
            'bankBalance' => BankAccount::totalActiveBalance(),
            'approvalsPending' => Payment::awaitingCount(),
        ];

        $dailyTrend = array_map(fn ($r) => [
            'day' => $r['day'], 'collection' => (float) $r['collection'], 'pending' => (float) $r['pending'],
        ], DB::all(
            "SELECT DATE_FORMAT(d.day, '%b %d') AS day,
                COALESCE((SELECT SUM(collected_amount) FROM collections WHERE status = 'completed' AND collection_date = d.day), 0) AS collection,
                COALESCE((SELECT SUM(due_amount - paid_amount) FROM due_schedules WHERE due_date = d.day), 0) AS pending
             FROM (SELECT CURDATE() - INTERVAL n DAY AS day FROM
                   (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) nums) d
             ORDER BY d.day"
        ));

        $monthlyTrend = array_map(fn ($r) => [
            'month' => $r['month'], 'collection' => (float) $r['collection'], 'pending' => (float) $r['pending'],
        ], DB::all(
            "SELECT DATE_FORMAT(m.start, '%b') AS month,
                COALESCE((SELECT SUM(collected_amount) FROM collections WHERE status = 'completed'
                          AND collection_date >= m.start AND collection_date < m.start + INTERVAL 1 MONTH), 0) AS collection,
                COALESCE((SELECT SUM(due_amount - paid_amount) FROM due_schedules
                          WHERE due_date >= m.start AND due_date < m.start + INTERVAL 1 MONTH), 0) AS pending
             FROM (SELECT DATE_FORMAT(CURDATE() - INTERVAL n MONTH, '%Y-%m-01') AS start FROM
                   (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) nums) m
             ORDER BY m.start"
        ));

        $branchPerformance = array_map(fn ($r) => [
            'branch' => $r['branch'], 'collection' => (float) $r['collection'], 'pending' => (float) $r['pending'],
        ], DB::all(
            "SELECT b.name AS branch,
                COALESCE(SUM(d.paid_amount), 0) AS collection, COALESCE(SUM(d.due_amount - d.paid_amount), 0) AS pending
             FROM branches b
             LEFT JOIN customers c ON c.branch_id = b.id
             LEFT JOIN due_schedules d ON d.customer_id = c.id
             GROUP BY b.id, b.name ORDER BY b.code"
        ));

        $staffPerformance = array_map(fn ($r) => [
            'staff' => $r['staff'], 'collected' => (float) $r['collected'], 'target' => (float) $r['target'],
        ], DB::all(
            "SELECT u.name AS staff, u.monthly_target AS target,
                COALESCE((SELECT SUM(collected_amount) FROM collections WHERE staff_id = u.id AND status = 'completed'
                          AND collection_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')), 0) AS collected
             FROM users u WHERE u.role = 'staff' AND u.status = 'active' ORDER BY u.name"
        ));

        return compact('stats', 'dailyTrend', 'monthlyTrend', 'branchPerformance', 'staffPerformance');
    }

    /** Percentage change, or null when there is nothing to compare against. */
    private static function change(float $current, float $previous): ?float
    {
        return $previous > 0 ? round(($current - $previous) / $previous * 100, 1) : null;
    }
}
