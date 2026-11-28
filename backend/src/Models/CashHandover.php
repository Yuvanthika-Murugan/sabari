<?php

declare(strict_types=1);

namespace App\Models;

/** Cash handed over to the office by collection staff and agents (HND…). */
final class CashHandover extends Model
{
    protected const TABLE = 'cash_handovers';
    protected const LABEL = 'Cash handover';
    protected const SELECT = "SELECT CAST(h.id AS CHAR) AS id, h.handover_no AS handoverNo,
        DATE_FORMAT(h.handover_date, '%Y-%m-%d') AS date, DATE_FORMAT(h.created_at, '%H:%i') AS time,
        CAST(h.user_id AS CHAR) AS userId, u.name AS userName, h.amount, h.remarks,
        COALESCE(c.name, '-') AS createdBy
        FROM cash_handovers h
        JOIN users u ON u.id = h.user_id
        LEFT JOIN users c ON c.id = h.created_by";
    protected const KEY = 'h.id';
    protected const ORDER = ' ORDER BY h.handover_date DESC, h.id DESC';
    protected const FLOATS = ['amount'];

    /** Handovers by one collection staff member / agent. */
    public static function forUser(int $userId): array
    {
        return self::query('h.user_id = ?', [$userId]);
    }
}
