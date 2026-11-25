<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Input;
use App\Core\Request;
use App\Models\ChitGroup;
use App\Models\ChitGroupCode;
use App\Models\Customer;
use App\Services\Audit;

final class GroupController
{
    public static function index(Request $req): array
    {
        return ChitGroup::all();
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $data = self::validated($req->input());
        $data['group_code'] = ChitGroup::nextCode('group_code', 'GRP', 3);
        $id = ChitGroup::create($data);
        Audit::log('Group Created', 'Groups', $data['group_code'], '-', $data['group_name']);
        return ChitGroup::find($id);
    }

    public static function update(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $existing = ChitGroup::find($id);
        $data = self::validated($req->input());
        ChitGroup::update($id, $data);
        Audit::log('Group Updated', 'Groups', $existing['groupCode'], $existing['groupName'], $data['group_name']);
        return ChitGroup::find($id);
    }

    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $group = ChitGroup::find($id);
        if (Customer::hasGroup($id)) {
            throw new HttpException(409, 'This group still has customers. Transfer them before deleting the group.');
        }
        ChitGroup::delete($id);
        Audit::log('Group Deleted', 'Groups', $group['groupCode'], $group['groupName'], '-');
        return ['ok' => true];
    }

    /**
     * startDate is the first auction date. The closing (end) date is always
     * worked out from it, the number of installments and the auction type.
     */
    private static function validated(Input $in): array
    {
        $codeId = $in->id('groupCodeId', true);
        $byValue = $in->num('auctionByValue', false, 1, null);
        $data = [
            'group_code_id' => $codeId,
            'group_name' => $in->str('groupName', true, 120),
            'branch_id' => $in->id('branchId', true),
            'pso_number' => $in->pattern('psoNumber', '/^[A-Za-z0-9\/-]+$/', 'Use letters, digits, - and / only', false, 40, false),
            'pso_date' => $in->date('psoDate'),
            'agreement_no' => $in->pattern('agreementNo', '/^[A-Za-z0-9\/-]+$/', 'Use letters, digits, - and / only', false, 40, false),
            'agreement_date' => $in->date('agreementDate'),
            'duration' => $in->int('duration', true, 1, 1000),
            'group_value' => $in->num('groupValue', true, 1),
            'admission_fee' => $in->num('admissionFee', false, 0),
            'service_tax' => $in->num('serviceTax', false, 0),
            'frequency' => $in->enum('frequency', ['daily', 'weekly', 'monthly', 'bimonthly'], 'monthly'),
            'start_date' => $in->date('startDate', true),
            'auction_time_from' => self::time($in, 'auctionTimeFrom'),
            'auction_time_to' => self::time($in, 'auctionTimeTo'),
            'auction_by' => $in->enum('auctionBy', ['day', 'week'], 'day'),
            'auction_by_value' => $byValue === null ? null : (int) $byValue,
            'company_type' => $in->str('companyType', false, 40),
            'company_ticket_no' => $in->pattern('companyTicketNo', '/^[A-Za-z0-9\/-]+$/', 'Use letters, digits, - and / only', false, 20, false),
            'company_auction_no' => $in->pattern('companyAuctionNo', '/^[A-Za-z0-9\/-]+$/', 'Use letters, digits, - and / only', false, 20, false),
            'company_comm_pct' => $in->percent('companyCommPct'),
            'authorized' => $in->str('authorized', false, 5, '1') === '1' ? 1 : 0,
            'fdr_details' => $in->str('fdrDetails', false, 5, '0') === '1' ? 1 : 0,
            'status' => $in->enum('status', ['active', 'inactive', 'completed'], 'active'),
        ];

        // Members come from the group code (series).
        $code = $codeId ? ChitGroupCode::findOrNull($codeId) : null;
        if ($codeId && !$code) {
            $in->error('groupCodeId', 'Group code not found');
        }
        $data['number_of_members'] = $code ? $code['members'] : 0;

        $max = $data['auction_by'] === 'day' ? 31 : 5;
        if ($byValue !== null && $byValue > $max) {
            $in->error('auctionByValue', $data['auction_by'] === 'day' ? 'Must be a day of the month (1–31)' : 'Must be a week of the month (1–5)');
        }
        if ($data['auction_time_from'] && $data['auction_time_to'] && $data['auction_time_to'] <= $data['auction_time_from']) {
            $in->error('auctionTimeTo', 'Must be after the start time');
        }
        if ($data['company_comm_pct'] > 100) {
            $in->error('companyCommPct', 'Must be at most 100');
        }
        $in->validate();

        $data['end_date'] = ChitGroup::closingDate($data['start_date'], $data['duration'], $data['frequency']);
        return $data;
    }

    private static function time(Input $in, string $key): ?string
    {
        return $in->has($key) && trim((string) $in->str($key)) !== '' ? $in->time($key, '') : null;
    }
}
