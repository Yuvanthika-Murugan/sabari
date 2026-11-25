<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/**
 * Installments owed by each customer. Status (paid / partially paid / overdue /
 * due today / upcoming) is derived from the amounts and dates when read.
 */
final class DueSchedule extends Model
{
    protected const TABLE = 'due_schedules';
    protected const SELECT = "SELECT CAST(d.id AS CHAR) AS id, CAST(d.customer_id AS CHAR) AS customerId,
        COALESCE(CAST(d.group_id AS CHAR), '') AS groupId, d.due_number AS dueNumber,
        DATE_FORMAT(d.due_date, '%Y-%m-%d') AS dueDate, d.due_amount AS dueAmount, d.paid_amount AS paidAmount,
        d.due_amount - d.paid_amount AS pendingAmount, DATE_FORMAT(d.payment_date, '%Y-%m-%d') AS paymentDate,
        CASE WHEN d.paid_amount >= d.due_amount THEN 'paid'
             WHEN d.paid_amount > 0 THEN 'partially_paid'
             WHEN d.due_date < CURDATE() THEN 'overdue'
             WHEN d.due_date = CURDATE() THEN 'due_today'
             ELSE 'upcoming' END AS status,
        COALESCE((SELECT col.receipt_no FROM collections col
                  WHERE col.customer_id = d.customer_id AND col.due_number = d.due_number AND col.status = 'completed'
                  ORDER BY col.id DESC LIMIT 1), '') AS receiptNo
        FROM due_schedules d";
    protected const KEY = 'd.id';
    protected const ORDER = ' ORDER BY d.customer_id, d.due_number';
    protected const FLOATS = ['dueAmount', 'paidAmount', 'pendingAmount'];
    protected const INTS = ['dueNumber'];

    public static function forCustomer(int $customerId): array
    {
        return self::query('d.customer_id = ?', [$customerId]);
    }

    /** Creates the installments: (group value / members) spread evenly over the group's duration. */
    public static function createFor(int $customerId, array $group, string $joiningDate): void
    {
        // Each installment is the group value divided by the number of installments, so a
        // subscriber pays the full chit value over the group's life (one ticket per member).
        $count = max(1, (int) $group['duration']);
        $installment = round((float) $group['group_value'] / $count, 2);
        [$n, $unit] = explode(' ', ChitGroup::STEPS[$group['frequency']]);
        $start = new \DateTimeImmutable($joiningDate);

        for ($i = 1; $i <= $count; $i++) {
            $periods = $i * (int) $n;
            self::create([
                'customer_id' => $customerId,
                'group_id' => $group['id'],
                'due_number' => $i,
                'due_date' => $start->modify("+$periods $unit")->format('Y-m-d'),
                'due_amount' => $installment,
            ]);
        }
    }

    /** Unpaid installments, oldest first, locked for the rest of the transaction. */
    public static function unpaidForUpdate(int $customerId, int $fromDue = 1): array
    {
        return DB::all(
            'SELECT id, due_number, due_date, due_amount, paid_amount FROM due_schedules
             WHERE customer_id = ? AND due_number >= ? AND paid_amount < due_amount ORDER BY due_number FOR UPDATE',
            [$customerId, $fromDue]
        );
    }

    /** Installments with something paid, latest first, locked for the rest of the transaction. */
    public static function paidForUpdate(int $customerId): array
    {
        return DB::all(
            'SELECT id, paid_amount FROM due_schedules WHERE customer_id = ? AND paid_amount > 0 ORDER BY due_number DESC FOR UPDATE',
            [$customerId]
        );
    }

    public static function addPayment(int $id, float $amount, string $date): void
    {
        DB::exec('UPDATE due_schedules SET paid_amount = paid_amount + ?, payment_date = ? WHERE id = ?', [$amount, $date, $id]);
    }

    /** Takes a payment back off an installment; clears the payment date once nothing is left paid. */
    public static function removePayment(int $id, float $amount): void
    {
        DB::exec('UPDATE due_schedules SET paid_amount = paid_amount - ?, payment_date = IF(paid_amount <= 0, NULL, payment_date) WHERE id = ?', [$amount, $id]);
    }

    public static function reduceDue(int $id, float $amount): void
    {
        DB::exec('UPDATE due_schedules SET due_amount = due_amount - ? WHERE id = ?', [$amount, $id]);
    }

    /** Moves the customer's unpaid installments to another group (on transfer). */
    public static function moveUnpaidToGroup(int $customerId, int $groupId): void
    {
        DB::exec('UPDATE due_schedules SET group_id = ? WHERE customer_id = ? AND paid_amount < due_amount', [$groupId, $customerId]);
    }

    /** Everything the customer still owes. */
    public static function balance(int $customerId): float
    {
        return (float) DB::value('SELECT COALESCE(SUM(due_amount - paid_amount), 0) FROM due_schedules WHERE customer_id = ?', [$customerId]);
    }
}
