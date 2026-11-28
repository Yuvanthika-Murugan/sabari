<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\DayEndClosing;
use App\Services\Audit;
use App\Services\Visibility;

/**
 * Day-end reconciliation. Open days are recalculated from the books every time
 * they are read; closing a day freezes its figures and locks new entries for it.
 */
final class DayEndController
{
    public static function index(Request $req): array
    {
        return Visibility::adminOnly(DayEndClosing::all());
    }

    public static function close(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        DayEndClosing::sync();
        $day = DayEndClosing::recordOrFail($id);
        if ($day['status'] === 'closed') {
            throw HttpException::unprocessable('This day is already closed');
        }

        $in = $req->input();
        $physical = $in->num('physicalCash', true);
        $remarks = $in->str('remarks');
        $difference = round($physical - (float) $day['expected_closing_cash'], 2);
        if (abs($difference) > 0.001 && $remarks === '') {
            $in->error('remarks', 'Explain the cash difference before closing');
        }
        if ((int) $day['pending_approvals'] > 0 && !Auth::is('md')) {
            $in->error('physicalCash', 'Payments are awaiting approval. Only the MD can override and close this day.');
        }
        $in->validate();

        DayEndClosing::update($id, [
            'physical_cash' => $physical,
            'difference' => $difference,
            'remarks' => $remarks ?: 'All matched',
            'status' => 'closed',
            'closed_by' => Auth::id(),
            'closed_at' => date('Y-m-d H:i:s'),
        ]);
        Audit::log('Day Closed', 'Day End', $day['closing_date'], 'open', 'closed');
        return ['ok' => true];
    }
}
