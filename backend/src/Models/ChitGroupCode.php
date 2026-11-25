<?php

declare(strict_types=1);

namespace App\Models;

/** Group series master ("Chit Group Code"): the value, members and fees a chit group is created from. */
final class ChitGroupCode extends Model
{
    protected const TABLE = 'chit_group_codes';
    protected const LABEL = 'Group code';
    protected const SELECT = "SELECT CAST(c.id AS CHAR) AS id, c.series, c.group_value AS groupValue, c.members,
        c.admission_fee AS admissionFee, COALESCE(CAST(c.auction_day AS CHAR), '') AS auctionDay,
        c.company_comm_pct AS companyCommPct, c.status,
        (SELECT COUNT(*) FROM chit_groups g WHERE g.group_code_id = c.id) AS groupCount
        FROM chit_group_codes c";
    protected const KEY = 'c.id';
    protected const ORDER = ' ORDER BY c.group_value, c.series';
    protected const FLOATS = ['groupValue', 'admissionFee', 'companyCommPct'];
    protected const INTS = ['members', 'groupCount'];
}
