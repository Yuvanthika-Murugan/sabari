<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\Collection;
use App\Services\Audit;
use App\Services\Ledger;

final class CollectionController
{
    public const MODES = ['cash', 'upi', 'bank_transfer', 'cheque'];

    public static function index(Request $req): array
    {
        return Collection::valid();
    }

    public static function store(Request $req): array
    {
        $in = $req->input();
        $customerId = $in->id('customerId', true);
        $dueNumber = $in->id('dueNumber');
        $amount = $in->num('amount', true, 1);
        $mode = $in->enum('paymentMode', self::MODES);
        $reference = $in->reference('referenceNo');
        $date = $in->date('date', false, date('Y-m-d'));
        $time = $in->time('time', date('H:i:s'));
        $remarks = $in->str('remarks');
        $type = $in->enum('receiptType', ['chit', 'arrear'], 'chit');
        if ($mode !== null && $mode !== 'cash' && $reference === '') {
            $in->error('referenceNo', 'Reference number is required for non-cash payments');
        }
        $in->validate();

        $receipt = DB::transaction(fn () => Ledger::collect($customerId, $dueNumber, $amount, $mode, $reference, $date, $time, $remarks, $type));
        return ['receiptNo' => $receipt];
    }

    /**
     * Cancels a wrongly entered receipt. Only the customer's latest receipt can be
     * cancelled, so the reversal exactly undoes it.
     */
    public static function cancel(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $in = $req->input();
        $reason = $in->str('reason', true);
        $in->validate();

        $receipt = Collection::withCustomer($id) ?? throw HttpException::notFound('Receipt');
        if ($receipt['status'] !== 'completed') {
            throw HttpException::unprocessable('This receipt is already cancelled');
        }
        if (str_starts_with($receipt['remarks'], 'Approved payment ')) {
            throw HttpException::unprocessable('This receipt was created by an approved payment and cannot be cancelled here');
        }
        if (Collection::latestValidId((int) $receipt['customer_id']) !== $id) {
            throw HttpException::unprocessable("Only {$receipt['name']}'s latest receipt can be cancelled. Cancel the newer receipts first.");
        }
        $today = date('Y-m-d');
        Ledger::assertDayOpen($today);

        DB::transaction(function () use ($receipt, $reason, $today) {
            Ledger::reverseReceipt($receipt, $reason, $today);
            Audit::log('Receipt Cancelled', 'Collections', $receipt['receipt_no'], Audit::money((float) $receipt['collected_amount']), $reason);
        });
        return ['ok' => true];
    }
}
