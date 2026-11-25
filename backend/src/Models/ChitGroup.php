<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

final class ChitGroup extends Model
{
    protected const TABLE = 'chit_groups';
    protected const LABEL = 'Group';
    protected const SELECT = "SELECT CAST(g.id AS CHAR) AS id, g.group_code AS groupCode, g.group_name AS groupName,
        CAST(g.branch_id AS CHAR) AS branchId, g.duration, g.group_value AS groupValue,
        g.number_of_members AS numberOfMembers,
        DATE_FORMAT(g.start_date, '%Y-%m-%d') AS startDate, DATE_FORMAT(g.end_date, '%Y-%m-%d') AS endDate,
        g.frequency, g.status,
        COALESCE(CAST(g.group_code_id AS CHAR), '') AS groupCodeId, COALESCE(gc.series, '') AS series,
        g.pso_number AS psoNumber, COALESCE(DATE_FORMAT(g.pso_date, '%Y-%m-%d'), '') AS psoDate,
        g.agreement_no AS agreementNo, COALESCE(DATE_FORMAT(g.agreement_date, '%Y-%m-%d'), '') AS agreementDate,
        g.admission_fee AS admissionFee, g.service_tax AS serviceTax,
        COALESCE(TIME_FORMAT(g.auction_time_from, '%H:%i'), '') AS auctionTimeFrom,
        COALESCE(TIME_FORMAT(g.auction_time_to, '%H:%i'), '') AS auctionTimeTo,
        g.auction_by AS auctionBy, COALESCE(CAST(g.auction_by_value AS CHAR), '') AS auctionByValue,
        g.company_type AS companyType, g.company_ticket_no AS companyTicketNo, g.company_auction_no AS companyAuctionNo,
        g.company_comm_pct AS companyCommPct, g.authorized, g.fdr_details AS fdrDetails,
        COALESCE((SELECT SUM(d.paid_amount) FROM due_schedules d WHERE d.group_id = g.id), 0) AS collected
        FROM chit_groups g
        LEFT JOIN chit_group_codes gc ON gc.id = g.group_code_id";
    protected const KEY = 'g.id';
    protected const ORDER = ' ORDER BY g.group_code';
    protected const FLOATS = ['groupValue', 'collected', 'admissionFee', 'serviceTax', 'companyCommPct'];
    protected const INTS = ['duration', 'numberOfMembers'];
    protected const BOOLS = ['authorized', 'fdrDetails'];

    /** strtotime/DateTime step for one installment period. */
    public const STEPS = ['daily' => '1 day', 'weekly' => '1 week', 'monthly' => '1 month', 'bimonthly' => '2 months'];

    /** Date of the last installment: the first auction date plus (installments - 1) periods. */
    public static function closingDate(string $firstDate, int $installments, string $frequency): string
    {
        [$n, $unit] = explode(' ', self::STEPS[$frequency]);
        $periods = max(0, $installments - 1) * (int) $n;
        return (new \DateTimeImmutable($firstDate))->modify("+$periods $unit")->format('Y-m-d');
    }

    protected static function shape(array $rows): array
    {
        $rows = parent::shape($rows);
        foreach ($rows as &$row) {
            $row['pending'] = max(0, $row['groupValue'] - $row['collected']);
        }
        return $rows;
    }

    /** Group codes keyed by id, e.g. [1 => 'GRP001']. */
    public static function codes(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if (!$ids) {
            return [];
        }
        $marks = implode(', ', array_fill(0, count($ids), '?'));
        return array_column(DB::all("SELECT id, group_code FROM chit_groups WHERE id IN ($marks)", $ids), 'group_code', 'id');
    }
}
