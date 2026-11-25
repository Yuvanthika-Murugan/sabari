<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Chit auctions: one per installment of a group. The winner forgoes bid_amount;
 * the foreman keeps commission_amount and the rest is a dividend to the members.
 */
final class Auction extends Model
{
    protected const TABLE = 'auctions';
    protected const LABEL = 'Auction';
    protected const SELECT = "SELECT CAST(a.id AS CHAR) AS id, a.auction_code AS auctionCode,
        CAST(a.group_id AS CHAR) AS groupId, g.group_name AS groupName, g.group_value AS groupValue,
        a.auction_no AS auctionNo, DATE_FORMAT(a.auction_date, '%Y-%m-%d') AS auctionDate,
        CAST(a.customer_id AS CHAR) AS customerId, c.name AS customerName,
        a.bid_amount AS bidAmount, a.commission_amount AS commissionAmount, a.dividend_amount AS dividendAmount,
        a.dividend_per_member AS dividendPerMember, a.prize_amount AS prizeAmount,
        a.payout_status AS payoutStatus, COALESCE(a.payout_mode, '') AS payoutMode,
        COALESCE(CAST(a.bank_account_id AS CHAR), '') AS bankAccountId, a.payout_reference AS payoutReference,
        COALESCE(DATE_FORMAT(a.paid_date, '%Y-%m-%d'), '') AS paidDate, a.remarks
        FROM auctions a
        JOIN chit_groups g ON g.id = a.group_id
        JOIN customers c ON c.id = a.customer_id";
    protected const KEY = 'a.id';
    protected const ORDER = ' ORDER BY a.auction_date DESC, a.id DESC';
    protected const FLOATS = ['groupValue', 'bidAmount', 'commissionAmount', 'dividendAmount', 'dividendPerMember', 'prizeAmount'];
    protected const INTS = ['auctionNo'];

    public static function installmentTaken(int $groupId, int $auctionNo): bool
    {
        return self::exists('group_id = ? AND auction_no = ?', [$groupId, $auctionNo]);
    }

    public static function alreadyWon(int $groupId, int $customerId): bool
    {
        return self::exists('group_id = ? AND customer_id = ?', [$groupId, $customerId]);
    }
}
