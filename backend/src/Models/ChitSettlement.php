<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Chit settlement (payout) for a customer whose chit is finishing (SET…):
 * requested by the collection staff / agent, approved by the Super Admin (MD),
 * then paid out by the Admin.
 */
final class ChitSettlement extends Model
{
    protected const TABLE = 'chit_settlements';
    protected const LABEL = 'Chit settlement';
    protected const SELECT = "SELECT CAST(s.id AS CHAR) AS id, s.settlement_no AS settlementNo,
        CAST(s.customer_id AS CHAR) AS customerId, c.customer_code AS customerCode, c.name AS customerName, c.mobile,
        CAST(s.group_id AS CHAR) AS groupId, g.group_name AS groupName, g.group_code AS groupCode, g.group_value AS groupValue,
        s.amount, s.status, s.request_note AS requestNote,
        COALESCE(rq.name, '-') AS requestedBy, DATE_FORMAT(s.requested_at, '%Y-%m-%d %H:%i') AS requestedAt,
        s.decision_note AS decisionNote, COALESCE(dc.name, '') AS decidedBy,
        COALESCE(DATE_FORMAT(s.decided_at, '%Y-%m-%d %H:%i'), '') AS decidedAt,
        COALESCE(s.payout_mode, '') AS payoutMode, COALESCE(CAST(s.bank_account_id AS CHAR), '') AS bankAccountId,
        s.payout_reference AS payoutReference, COALESCE(DATE_FORMAT(s.paid_date, '%Y-%m-%d'), '') AS paidDate,
        COALESCE(pd.name, '') AS paidBy,
        COALESCE(DATE_FORMAT(f.final_due, '%Y-%m-%d'), '') AS finalDueDate,
        COALESCE(CAST(c.staff_id AS CHAR), '') AS staffId, COALESCE(CAST(c.agent_id AS CHAR), '') AS agentId
        FROM chit_settlements s
        JOIN customers c ON c.id = s.customer_id
        JOIN chit_groups g ON g.id = s.group_id
        LEFT JOIN users rq ON rq.id = s.requested_by
        LEFT JOIN users dc ON dc.id = s.decided_by
        LEFT JOIN users pd ON pd.id = s.paid_by
        LEFT JOIN (SELECT customer_id, group_id, MAX(due_date) AS final_due FROM due_schedules GROUP BY customer_id, group_id) f
          ON f.customer_id = s.customer_id AND f.group_id = s.group_id";
    protected const KEY = 's.id';
    protected const ORDER = ' ORDER BY s.id DESC';
    protected const FLOATS = ['amount', 'groupValue'];

    /** Settlements a collection staff member / agent may see: ones they asked for, or for their customers. */
    public static function forStaff(int $userId): array
    {
        return self::query(
            '(s.requested_by = ? OR c.staff_id = ? OR c.agent_id IN (SELECT id FROM agents WHERE user_id = ?))',
            [$userId, $userId, $userId],
        );
    }
}
