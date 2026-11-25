<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\Voucher;
use App\Services\Audit;
use App\Services\Ledger;
use App\Services\Visibility;

final class VoucherController
{
    public static function index(Request $req): array
    {
        return Visibility::officeOnly(Voucher::all());
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $in = $req->input();
        $date = $in->date('date', false, date('Y-m-d'));
        $type = $in->enum('voucherType', ['payment', 'receipt', 'expense', 'contra']);
        $account = $in->str('account', true, 120);
        $amount = $in->num('amount', true, 1);
        $mode = $in->enum('paymentMode', ['cash', 'bank', 'upi']);
        $narration = $in->str('narration');
        $in->validate();
        Ledger::assertDayOpen($date);

        // MD/Admin vouchers are approved on entry; manager vouchers wait for approval.
        $approved = Auth::is('md', 'admin');

        $number = DB::transaction(function () use ($date, $type, $account, $amount, $mode, $narration, $approved) {
            $number = Voucher::nextCode('voucher_number', 'VCH', 6);
            Voucher::create([
                'voucher_number' => $number,
                'voucher_date' => $date,
                'voucher_type' => $type,
                'account' => $account,
                'amount' => $amount,
                'payment_mode' => $mode,
                'narration' => $narration,
                'created_by' => Auth::id(),
                'approval_status' => $approved ? 'approved' : 'pending',
            ]);
            if ($approved) {
                self::postCash($date, $number, $type, $mode, $narration ?: $account, $amount);
            }
            Audit::log('Voucher Created', 'Vouchers', $number, '-', Audit::money($amount));
            return $number;
        });
        return ['voucherNumber' => $number];
    }

    /** MD or Admin approves or rejects a manager's voucher; approval posts it to the cash book today. */
    public static function decide(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $in = $req->input();
        $decision = $in->enum('decision', ['approved', 'rejected']);
        $in->validate();

        $v = Voucher::recordOrFail($id);
        if ($v['approval_status'] !== 'pending') {
            throw HttpException::unprocessable('This voucher has already been ' . $v['approval_status']);
        }
        $today = date('Y-m-d');
        if ($decision === 'approved') {
            Ledger::assertDayOpen($today);
        }

        DB::transaction(function () use ($v, $id, $decision, $today) {
            Voucher::update($id, ['approval_status' => $decision]);
            if ($decision === 'approved') {
                self::postCash($today, $v['voucher_number'], $v['voucher_type'], $v['payment_mode'], $v['narration'] ?: $v['account'], (float) $v['amount']);
            }
            Audit::log($decision === 'approved' ? 'Voucher Approved' : 'Voucher Rejected', 'Vouchers', $v['voucher_number'], 'pending', $decision);
        });
        return ['ok' => true];
    }

    /** Cash vouchers (other than contra) move the cash book: receipts in, everything else out. */
    private static function postCash(string $date, string $number, string $type, string $mode, string $description, float $amount): void
    {
        if ($mode !== 'cash' || $type === 'contra') {
            return;
        }
        $isReceipt = $type === 'receipt';
        Ledger::cash($date, $number, $description, $isReceipt ? 0 : $amount, $isReceipt ? $amount : 0, $isReceipt ? 'receipt' : $type);
    }
}
