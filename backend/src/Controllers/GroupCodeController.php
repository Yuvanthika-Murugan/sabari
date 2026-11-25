<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Input;
use App\Core\Request;
use App\Models\ChitGroupCode;
use App\Services\Audit;

/** Chit group codes (series master) that chit groups are created from. */
final class GroupCodeController
{
    public static function index(Request $req): array
    {
        return ChitGroupCode::all();
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $data = self::validated($req->input());
        $id = ChitGroupCode::create($data);
        Audit::log('Group Code Created', 'Group Codes', $data['series'], '-', "{$data['members']} members");
        return ChitGroupCode::find($id);
    }

    public static function update(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $existing = ChitGroupCode::find($id);
        $data = self::validated($req->input(), $id);
        ChitGroupCode::update($id, $data);
        Audit::log('Group Code Updated', 'Group Codes', $data['series'], $existing['series'], $data['series']);
        return ChitGroupCode::find($id);
    }

    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $code = ChitGroupCode::find($id);
        if ($code['groupCount'] > 0) {
            throw new HttpException(409, 'Groups were created from this code. Set it to Inactive instead of deleting it.');
        }
        ChitGroupCode::delete($id);
        Audit::log('Group Code Deleted', 'Group Codes', $code['series'], $code['series'], '-');
        return ['ok' => true];
    }

    private static function validated(Input $in, ?int $id = null): array
    {
        $day = $in->has('auctionDay') && trim((string) $in->str('auctionDay')) !== '' ? $in->int('auctionDay', false, 1, 31) : null;
        $data = [
            'series' => $in->pattern('series', '/^[A-Za-z0-9\/-]+$/', 'Use letters, digits, - and / only', true, 30, false),
            'group_value' => $in->num('groupValue', true, 1),
            'members' => $in->int('members', true, 1, 1000),
            'admission_fee' => $in->num('admissionFee', true, 0),
            'auction_day' => $day === null ? null : (int) $day,
            'company_comm_pct' => $in->percent('companyCommPct'),
            'status' => $in->enum('status', ['active', 'inactive'], 'active'),
        ];
        if ($day !== null && $day > 31) {
            $in->error('auctionDay', 'Must be a day of the month (1–31)');
        }
        if ($data['company_comm_pct'] > 100) {
            $in->error('companyCommPct', 'Must be at most 100');
        }
        if ($data['series'] !== '' && ChitGroupCode::exists('series = ? AND id <> ?', [$data['series'], $id ?? 0])) {
            $in->error('series', 'This group series already exists');
        }
        $in->validate();
        return $data;
    }
}
