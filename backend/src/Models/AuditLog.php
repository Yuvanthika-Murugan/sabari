<?php

declare(strict_types=1);

namespace App\Models;

/** Append-only record of every change and sign-in. Rows are never updated or deleted. */
final class AuditLog extends Model
{
    protected const TABLE = 'audit_logs';
    protected const SELECT = "SELECT CAST(id AS CHAR) AS id, user_name AS user, role, action, module, record_id AS recordId,
        old_value AS oldValue, new_value AS newValue,
        DATE_FORMAT(created_at, '%Y-%m-%d') AS date, DATE_FORMAT(created_at, '%H:%i') AS time
        FROM audit_logs";
    protected const ORDER = ' ORDER BY created_at DESC, id DESC LIMIT 1000';
}
