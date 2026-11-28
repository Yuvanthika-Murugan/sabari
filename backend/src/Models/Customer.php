<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** Chit subscribers. Each customer belongs to one group at a time. */
final class Customer extends Model
{
    protected const TABLE = 'customers';
    protected const LABEL = 'Customer';
    /**
     * An active customer whose oldest unpaid due is this many days past its due date
     * is shown as inactive: 5 days for daily, 10 for weekly, 15 for monthly / bi-monthly.
     * The dues follow the group's frequency. Paying the overdue dues makes them active again.
     */
    private const GRACE_DAYS_SQL = "CASE COALESCE(g.frequency, c.collection_type) WHEN 'daily' THEN 5 WHEN 'weekly' THEN 10 ELSE 15 END";

    protected const SELECT = "SELECT CAST(c.id AS CHAR) AS id, c.customer_code AS customerId, c.name,
        c.father_spouse_name AS fatherSpouseName, c.mobile, c.alt_mobile AS altMobile, c.address, c.area,
        CAST(c.latitude AS CHAR) AS latitude, CAST(c.longitude AS CHAR) AS longitude,
        CAST(c.branch_id AS CHAR) AS branchId, COALESCE(CAST(c.staff_id AS CHAR), '') AS staffId,
        COALESCE(CAST(c.agent_id AS CHAR), '') AS agentId,
        COALESCE(CAST(c.group_id AS CHAR), '') AS groupId, DATE_FORMAT(c.joining_date, '%Y-%m-%d') AS joiningDate,
        CASE WHEN c.status = 'active' AND DATEDIFF(CURDATE(), o.oldest_unpaid) >= " . self::GRACE_DAYS_SQL . " THEN 'inactive' ELSE c.status END AS status,
        c.status AS savedStatus,
        COALESCE(c.status = 'active' AND DATEDIFF(CURDATE(), o.oldest_unpaid) >= " . self::GRACE_DAYS_SQL . ", 0) AS autoInactive,
        COALESCE(DATEDIFF(CURDATE(), o.oldest_unpaid), 0) AS daysUnpaid,
        c.photo_path AS photo,
        c.rep_name AS repName, c.pan_no AS panNo, COALESCE(DATE_FORMAT(c.dob, '%Y-%m-%d'), '') AS dob,
        c.phone, c.email, c.district, c.pincode, c.permanent_address AS permanentAddress, c.agent_type AS agentType,
        c.nominee_name AS nomineeName, c.nominee_relation AS nomineeRelation, c.nominee_mobile AS nomineeMobile,COALESCE(CAST(c.nominee_age AS CHAR), '') AS nomineeAge,
        c.intimation_type AS intimationType, c.intimation_card AS intimationCard, c.collection_type AS collectionType,
        COALESCE(d.total, 0) AS totalDue, COALESCE(d.paid, 0) AS paid, COALESCE(d.first_done, 0) AS firstDueCompleted
        FROM customers c
        LEFT JOIN (
          SELECT customer_id, SUM(due_amount) AS total, SUM(paid_amount) AS paid,
                 MAX(due_number = 1 AND paid_amount >= due_amount) AS first_done
          FROM due_schedules GROUP BY customer_id
        ) d ON d.customer_id = c.id
        LEFT JOIN (
          SELECT customer_id, MIN(due_date) AS oldest_unpaid
          FROM due_schedules WHERE paid_amount < due_amount AND due_date < CURDATE() GROUP BY customer_id
        ) o ON o.customer_id = c.id
        LEFT JOIN chit_groups g ON g.id = c.group_id";
    protected const KEY = 'c.id';
    protected const ORDER = ' ORDER BY c.customer_code';
    protected const FLOATS = ['totalDue', 'paid'];
    protected const INTS = ['daysUnpaid'];
    protected const BOOLS = ['autoInactive', 'firstDueCompleted', 'permanentAddress', 'intimationCard'];

    protected static function shape(array $rows): array
    {
        $rows = parent::shape($rows);
        foreach ($rows as &$row) {
            $row['pending'] = max(0, $row['totalDue'] - $row['paid']);
        }
        return $rows;
    }

    /** Ids of everyone in the group who shares in its dividends (all but closed accounts). */
    public static function dividendMembers(int $groupId): array
    {
        return array_map('intval', array_column(DB::all("SELECT id FROM customers WHERE group_id = ? AND status <> 'closed'", [$groupId]), 'id'));
    }

    /** Places taken in a group: its customers other than closed accounts. */
    public static function countInGroup(int $groupId): int
    {
        return (int) DB::one("SELECT COUNT(*) AS n FROM customers WHERE group_id = ? AND status <> 'closed'", [$groupId])['n'];
    }

    public static function inGroup(int $customerId, int $groupId): ?array
    {
        return DB::one('SELECT id, name, status FROM customers WHERE id = ? AND group_id = ?', [$customerId, $groupId]);
    }

    public static function moveTo(int $id, int $groupId, int $staffId, int $branchId): void
    {
        self::update($id, ['group_id' => $groupId, 'staff_id' => $staffId, 'branch_id' => $branchId]);
    }

    public static function inArea(string $area, int $branchId): bool
    {
        return self::exists('area = ? AND branch_id = ?', [$area, $branchId]);
    }

    public static function renameArea(string $from, string $to, int $branchId): void
    {
        DB::exec('UPDATE customers SET area = ? WHERE area = ? AND branch_id = ?', [$to, $from, $branchId]);
    }

    public static function hasAgent(int $agentId): bool
    {
        return self::exists('agent_id = ?', [$agentId]);
    }

    public static function hasGroup(int $groupId): bool
    {
        return self::exists('group_id = ?', [$groupId]);
    }
}
