<?php

declare(strict_types=1);

namespace App\Models;

/** Agents introduce customers and earn a commission on what those customers pay. */
final class Agent extends Model
{
    protected const TABLE = 'agents';
    protected const LABEL = 'Agent';
    protected const SELECT = "SELECT CAST(a.id AS CHAR) AS id, a.agent_code AS agentCode, a.name, a.mobile, a.address,
        CAST(a.branch_id AS CHAR) AS branchId, a.commission_pct AS commissionPct,
        COALESCE(DATE_FORMAT(a.joining_date, '%Y-%m-%d'), '') AS joiningDate, a.status
        FROM agents a";
    protected const KEY = 'a.id';
    protected const ORDER = ' ORDER BY a.agent_code';
    protected const FLOATS = ['commissionPct'];
}
