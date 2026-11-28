<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\Collection;
use App\Models\StaffLocation;
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
        $upiId = $mode === 'cash' ? '' : $in->pattern('upiId', '/^[\w.\-]{2,}@[a-zA-Z][a-zA-Z0-9.\-]{1,}$/', 'Enter a valid UPI ID, e.g. name@okbank', false, 60, false);
        $accountHolder = $mode === 'cash' ? '' : $in->name('accountHolder');
        // Bank / UPI receipts need something to trace them by: a reference number or the payer's UPI ID.
        if ($mode !== null && $mode !== 'cash' && $reference === '' && $upiId === '') {
            $in->error('referenceNo', 'Enter the reference number or the UPI ID for bank payments');
        }
        // Cash notes counted, e.g. "500x2,100x3". When given, they must add up to the amount.
        $denominations = $mode === 'cash' ? self::denominations($in->str('denominations')) : '';
        if ($denominations === null) {
            $in->error('denominations', 'Use note x count pairs, e.g. 500x2,100x3');
        } elseif ($denominations !== '' && $amount !== null && abs(self::denominationTotal($denominations) - $amount) > 0.001) {
            $in->error('denominations', 'The notes counted add up to ' . Audit::money(self::denominationTotal($denominations)) . ', not ' . Audit::money($amount));
        }
        $point = LocationController::point($req->body);
        $in->validate();

        $receipt = DB::transaction(function () use ($customerId, $dueNumber, $amount, $mode, $reference, $date, $time, $remarks, $type, $upiId, $accountHolder, $denominations, $point) {
            $receipt = Ledger::collect($customerId, $dueNumber, $amount, $mode, $reference, $date, $time, $remarks, $type, $upiId, $accountHolder);
            if ($denominations !== '' || $point !== null) {
                DB::exec('UPDATE collections SET denominations = ?, latitude = ?, longitude = ? WHERE receipt_no = ?',
                    [$denominations, $point[0] ?? null, $point[1] ?? null, $receipt]);
            }
            // A receipt made on the phone also refreshes the staff member's live position,
            // and gives the customer a map location if they have none yet.
            if ($point !== null) {
                StaffLocation::save(Auth::id(), $point[0], $point[1], $point[2]);
                DB::exec('UPDATE customers SET latitude = ?, longitude = ? WHERE id = ? AND latitude IS NULL',
                    [$point[0], $point[1], $customerId]);
            }
            return $receipt;
        });
        return ['receiptNo' => $receipt];
    }

    public const NOTES = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

    /** Normalised "note x count" list ('' when empty), or null when malformed. */
    private static function denominations(string $raw): ?string
    {
        $raw = preg_replace('/\s+/', '', $raw);
        if ($raw === '') {
            return '';
        }
        $parts = [];
        foreach (explode(',', $raw) as $pair) {
            if (!preg_match('/^(\d+)[xX*](\d{1,4})$/', $pair, $m) || !in_array((int) $m[1], self::NOTES, true)) {
                return null;
            }
            if ((int) $m[2] > 0) {
                $parts[(int) $m[1]] = ($parts[(int) $m[1]] ?? 0) + (int) $m[2];
            }
        }
        krsort($parts);
        return implode(',', array_map(fn ($note, $count) => "{$note}x{$count}", array_keys($parts), $parts));
    }

    private static function denominationTotal(string $list): float
    {
        $total = 0;
        foreach (array_filter(explode(',', $list)) as $pair) {
            [$note, $count] = array_map('intval', explode('x', $pair));
            $total += $note * $count;
        }
        return $total;
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
