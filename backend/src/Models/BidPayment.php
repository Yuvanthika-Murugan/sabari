<?php

declare(strict_types=1);

namespace App\Models;

/**
 * Bid (prize) payment to an auction winner (BP…), moved through
 * Apply -> Verify -> Approval (MD) -> Document -> Document Verify (MD) -> Payment Entry.
 * A Direct Payment is recorded with type 'direct' and status 'paid'.
 * Amounts come from the auction: auction amount = group value - dividend,
 * less the foreman commission = the prize to pay.
 */
final class BidPayment extends Model
{
    protected const TABLE = 'bid_payments';
    protected const LABEL = 'Bid payment';
    protected const SELECT = "SELECT CAST(p.id AS CHAR) AS id, p.request_no AS requestNo,
        CAST(p.auction_id AS CHAR) AS auctionId, a.auction_code AS auctionCode, a.auction_no AS auctionNo,
        DATE_FORMAT(a.auction_date, '%Y-%m-%d') AS auctionDate,
        CAST(a.customer_id AS CHAR) AS customerId, c.customer_code AS customerCode, c.name AS customerName, c.mobile,
        COALESCE(CAST(c.branch_id AS CHAR), '') AS branchId, COALESCE(b.name, '') AS branchName,
        CAST(a.group_id AS CHAR) AS groupId, g.group_name AS groupName, g.group_code AS groupCode, g.group_value AS groupValue,
        a.bid_amount AS bidAmount, (g.group_value - a.dividend_amount) AS auctionAmount,
        a.commission_amount AS commissionAmount, a.prize_amount AS toPay,
        p.type, p.status, p.apply_note AS applyNote,
        COALESCE(u1.name, '-') AS appliedBy, DATE_FORMAT(p.applied_at, '%Y-%m-%d %H:%i') AS appliedAt,
        COALESCE(u2.name, '') AS verifiedBy, COALESCE(DATE_FORMAT(p.verified_at, '%Y-%m-%d %H:%i'), '') AS verifiedAt,
        COALESCE(u3.name, '') AS approvedBy, COALESCE(DATE_FORMAT(p.approved_at, '%Y-%m-%d %H:%i'), '') AS approvedAt,
        p.documents, p.document_note AS documentNote,
        COALESCE(u4.name, '') AS documentedBy, COALESCE(DATE_FORMAT(p.documented_at, '%Y-%m-%d %H:%i'), '') AS documentedAt,
        COALESCE(u5.name, '') AS docVerifiedBy, COALESCE(DATE_FORMAT(p.doc_verified_at, '%Y-%m-%d %H:%i'), '') AS docVerifiedAt,
        p.reject_note AS rejectNote, p.rejected_stage AS rejectedStage,
        COALESCE(u6.name, '') AS rejectedBy, COALESCE(DATE_FORMAT(p.rejected_at, '%Y-%m-%d %H:%i'), '') AS rejectedAt,
        COALESCE(p.payout_mode, '') AS payoutMode, COALESCE(CAST(p.bank_account_id AS CHAR), '') AS bankAccountId,
        p.payout_reference AS payoutReference, COALESCE(DATE_FORMAT(p.paid_date, '%Y-%m-%d'), '') AS paidDate,
        COALESCE(u7.name, '') AS paidBy
        FROM bid_payments p
        JOIN auctions a ON a.id = p.auction_id
        JOIN chit_groups g ON g.id = a.group_id
        JOIN customers c ON c.id = a.customer_id
        LEFT JOIN branches b ON b.id = c.branch_id
        LEFT JOIN users u1 ON u1.id = p.applied_by
        LEFT JOIN users u2 ON u2.id = p.verified_by
        LEFT JOIN users u3 ON u3.id = p.approved_by
        LEFT JOIN users u4 ON u4.id = p.documented_by
        LEFT JOIN users u5 ON u5.id = p.doc_verified_by
        LEFT JOIN users u6 ON u6.id = p.rejected_by
        LEFT JOIN users u7 ON u7.id = p.paid_by";
    protected const KEY = 'p.id';
    protected const ORDER = ' ORDER BY p.id DESC';
    protected const FLOATS = ['groupValue', 'bidAmount', 'auctionAmount', 'commissionAmount', 'toPay'];
    protected const INTS = ['auctionNo'];

    /** The request still in progress (or paid) for an auction, if any. */
    public static function openFor(int $auctionId): ?string
    {
        $no = \App\Core\DB::value("SELECT request_no FROM bid_payments WHERE auction_id = ? AND status <> 'rejected' LIMIT 1", [$auctionId]);
        return $no ? (string) $no : null;
    }
}
