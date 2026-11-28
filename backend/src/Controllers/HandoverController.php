<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\Request;
use App\Models\CashHandover;
use App\Models\User;
use App\Services\Audit;
use App\Services\Ledger;
use App\Services\Visibility;

/**
 * Cash handed over to the office by collection staff and agents. It only moves money
 * already in the books (the receipts), so the cash book is not changed; it shows how
 * much cash each person has handed in and how much they still hold.
 */
final class HandoverController
{
    /** Office sees every handover; collection staff / agents see their own. */
    public static function visible(): array
    {
        return Visibility::office() ? CashHandover::all() : CashHandover::forUser(Auth::id());
    }

    public static function index(Request $req): array
    {
        return self::visible();
    }

    /**
     * Collection staff / agents record their own handover for today. Office users may
     * record one for a collection staff member ("userId") on any open day.
     */
    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager', 'staff');
        $isStaff = Auth::is('staff');
        $in = $req->input();
        $date = $isStaff ? date('Y-m-d') : $in->date('date', true);
        $userId = $isStaff ? Auth::id() : $in->id('userId', true);
        $amount = $in->num('amount', true, 1);
        $remarks = $in->str('remarks');
        if (!$isStaff && $userId !== null && (User::record($userId)['role'] ?? '') !== 'staff') {
            $in->error('userId', 'Choose a collection staff member or agent');
        }
        $in->validate();
        Ledger::assertDayOpen($date);

        $number = DB::transaction(function () use ($date, $userId, $amount, $remarks) {
            $number = CashHandover::nextCode('handover_no', 'HND', 6);
            CashHandover::create([
                'handover_no' => $number, 'handover_date' => $date, 'user_id' => $userId,
                'amount' => $amount, 'remarks' => $remarks, 'created_by' => Auth::id(),
            ]);
            Audit::log('Cash Handover', 'Collections', $number, '-', Audit::money($amount));
            return $number;
        });
        return ['handoverNo' => $number];
    }

    /** MD / Admin remove a wrong entry. */
    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $h = CashHandover::find($id);
        Ledger::assertDayOpen($h['date']);
        CashHandover::delete($id);
        Audit::log('Cash Handover Deleted', 'Collections', $h['handoverNo'], Audit::money($h['amount']), '-');
        return ['ok' => true];
    }
}
