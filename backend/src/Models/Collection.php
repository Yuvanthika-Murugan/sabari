<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/**
 * Receipts: chit installments (RCP…) and arrear collections (ARR…).
 * A cancelled receipt has status "rejected" and is kept apart from valid ones.
 */
final class Collection extends Model
{
    protected const TABLE = 'collections';
    protected const LABEL = 'Receipt';
    protected const SELECT = "SELECT CAST(col.id AS CHAR) AS id, col.receipt_no AS receiptNo, col.receipt_type AS receiptType,
        CAST(col.customer_id AS CHAR) AS customerId, c.name AS customerName,
        COALESCE(CAST(col.group_id AS CHAR), '') AS groupId, COALESCE(g.group_name, '-') AS groupName,
        CAST(col.branch_id AS CHAR) AS branchId, b.name AS branchName,
        COALESCE(CAST(col.staff_id AS CHAR), '') AS staffId, COALESCE(u.name, '-') AS staffName,
        col.due_number AS dueNumber, col.due_amount AS dueAmount, col.collected_amount AS collectedAmount,
        col.pending_amount AS pendingAmount, col.payment_mode AS paymentMode, col.reference_no AS referenceNo,
        DATE_FORMAT(col.collection_date, '%Y-%m-%d') AS date, TIME_FORMAT(col.collection_time, '%H:%i') AS time,
        col.remarks, col.status, col.cancel_reason AS cancelReason, COALESCE(cu.name, '') AS cancelledBy,
        COALESCE(DATE_FORMAT(col.cancelled_at, '%Y-%m-%d %H:%i'), '') AS cancelledAt
        FROM collections col
        JOIN customers c ON c.id = col.customer_id
        JOIN branches b ON b.id = col.branch_id
        LEFT JOIN chit_groups g ON g.id = col.group_id
        LEFT JOIN users u ON u.id = col.staff_id
        LEFT JOIN users cu ON cu.id = col.cancelled_by";
    protected const KEY = 'col.id';
    protected const ORDER = ' ORDER BY col.collection_date DESC, col.collection_time DESC, col.id DESC';
    protected const FLOATS = ['dueAmount', 'collectedAmount', 'pendingAmount'];
    protected const INTS = ['dueNumber'];

    /** Valid receipts. Cancelled ones are kept apart so no total counts them. */
    public static function valid(): array
    {
        return self::query("col.status <> 'rejected'");
    }

    public static function cancelled(): array
    {
        return self::query("col.status = 'rejected'");
    }

    /** The stored receipt with the customer's name. */
    public static function withCustomer(int $id): ?array
    {
        return DB::one('SELECT col.*, c.name FROM collections col JOIN customers c ON c.id = col.customer_id WHERE col.id = ?', [$id]);
    }

    public static function latestValidId(int $customerId): int
    {
        return (int) DB::value("SELECT MAX(id) FROM collections WHERE customer_id = ? AND status = 'completed'", [$customerId]);
    }

    public static function existsFor(int $customerId): bool
    {
        return self::exists('customer_id = ?', [$customerId]);
    }

    /** Valid receipts collected on a date, with the cash and UPI parts. */
    public static function totalsOn(string $date): array
    {
        // Cash received that day counts even if the receipt was cancelled later; the
        // cancellation's reversing cash entry reduces the day it was cancelled on instead.
        return DB::one(
            "SELECT COALESCE(SUM(CASE WHEN status = 'completed' THEN collected_amount END), 0) AS total,
                    COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN collected_amount END), 0) AS cash,
                    COALESCE(SUM(CASE WHEN payment_mode = 'upi' AND status = 'completed' THEN collected_amount END), 0) AS upi
             FROM collections WHERE collection_date = ? AND status IN ('completed', 'rejected')",
            [$date]
        );
    }

    /** Sum of valid receipts matching a condition on the collections table. */
    public static function sumWhere(string $where, array $params = []): float
    {
        return (float) DB::value("SELECT COALESCE(SUM(collected_amount), 0) FROM collections WHERE status = 'completed' AND $where", $params);
    }
}
