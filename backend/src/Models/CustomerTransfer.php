<?php

declare(strict_types=1);

namespace App\Models;

/** History of customers moved between groups, staff and branches. */
final class CustomerTransfer extends Model
{
    protected const TABLE = 'customer_transfers';
    protected const SELECT = "SELECT CAST(t.id AS CHAR) AS id, CAST(t.customer_id AS CHAR) AS customerId, c.name AS customerName,
        COALESCE(CAST(t.from_group_id AS CHAR), '') AS fromGroupId, COALESCE(CAST(t.to_group_id AS CHAR), '') AS toGroupId,
        COALESCE(CAST(t.from_staff_id AS CHAR), '') AS fromStaffId, COALESCE(CAST(t.to_staff_id AS CHAR), '') AS toStaffId,
        COALESCE(CAST(t.from_branch_id AS CHAR), '') AS fromBranchId, COALESCE(CAST(t.to_branch_id AS CHAR), '') AS toBranchId,
        DATE_FORMAT(t.transfer_date, '%Y-%m-%d') AS date, t.reason
        FROM customer_transfers t JOIN customers c ON c.id = t.customer_id";
    protected const KEY = 't.id';
    protected const ORDER = ' ORDER BY t.transfer_date DESC, t.id DESC';
}
