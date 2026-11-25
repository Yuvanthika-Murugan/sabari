<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/**
 * Payments going through approval (table payment_approvals):
 * payment_informed -> manager_accepted -> completed, or rejected / sent_back.
 */
final class Payment extends Model
{
    protected const TABLE = 'payment_approvals';
    protected const LABEL = 'Payment';
    protected const SELECT = "SELECT CAST(p.id AS CHAR) AS id, p.payment_code AS paymentId, p.payment_type AS paymentType,
        COALESCE(CAST(p.customer_id AS CHAR), '') AS customerId,
        COALESCE(c.name, CONCAT(e.name, ' (salary ', p.salary_month, ')'), CONCAT(UPPER(LEFT(p.payment_type, 1)), SUBSTRING(p.payment_type, 2), ' payment')) AS customerName,
        COALESCE(CAST(p.employee_id AS CHAR), '') AS employeeId, COALESCE(p.salary_month, '') AS salaryMonth,
        p.amount, p.payment_mode AS paymentMode, p.reference_no AS referenceNo,
        CAST(p.submitted_by AS CHAR) AS staffId, s.name AS staffName,
        COALESCE(CAST(p.branch_id AS CHAR), '') AS branchId, COALESCE(b.name, '-') AS branchName,
        DATE_FORMAT(p.submitted_at, '%Y-%m-%d %H:%i') AS submittedTime, p.current_stage AS currentStage,
        s.name AS submittedBy,
        CAST(p.manager_id AS CHAR) AS managerId, m.name AS managerName,
        DATE_FORMAT(p.manager_action_at, '%Y-%m-%d %H:%i') AS managerActionTime,
        CAST(p.md_id AS CHAR) AS mdId, md.name AS mdName,
        DATE_FORMAT(p.md_action_at, '%Y-%m-%d %H:%i') AS mdActionTime,
        p.remarks
        FROM payment_approvals p
        JOIN users s ON s.id = p.submitted_by
        LEFT JOIN customers c ON c.id = p.customer_id
        LEFT JOIN users e ON e.id = p.employee_id
        LEFT JOIN branches b ON b.id = p.branch_id
        LEFT JOIN users m ON m.id = p.manager_id
        LEFT JOIN users md ON md.id = p.md_id";
    protected const KEY = 'p.id';
    protected const ORDER = ' ORDER BY p.submitted_at DESC, p.id DESC';
    protected const FLOATS = ['amount'];

    /** Stages where a payment is still waiting for someone to act. */
    public const IN_FLIGHT = ['payment_informed', 'manager_accepted', 'md_approved'];

    /** Customer payments still waiting for approval. */
    public static function inFlightFor(int $customerId): float
    {
        return (float) DB::value(
            "SELECT COALESCE(SUM(amount), 0) FROM payment_approvals
             WHERE customer_id = ? AND current_stage IN ('payment_informed', 'manager_accepted', 'md_approved')",
            [$customerId]
        );
    }

    /** Salary paid or awaiting approval for an employee's month. */
    public static function salaryTaken(int $employeeId, string $month): float
    {
        return (float) DB::value(
            "SELECT COALESCE(SUM(amount), 0) FROM payment_approvals
             WHERE employee_id = ? AND salary_month = ? AND current_stage IN ('payment_informed', 'manager_accepted', 'md_approved', 'completed')",
            [$employeeId, $month]
        );
    }

    public static function awaitingCount(?string $upToDate = null): int
    {
        return $upToDate === null
            ? (int) DB::value("SELECT COUNT(*) FROM payment_approvals WHERE current_stage IN ('payment_informed','manager_accepted','md_approved')")
            : (int) DB::value("SELECT COUNT(*) FROM payment_approvals WHERE current_stage IN ('payment_informed','manager_accepted','md_approved') AND DATE(submitted_at) <= ?", [$upToDate]);
    }

    public static function rejectedOn(string $date): int
    {
        return (int) DB::value("SELECT COUNT(*) FROM payment_approvals WHERE current_stage = 'rejected' AND DATE(COALESCE(md_action_at, manager_action_at)) = ?", [$date]);
    }
}
