<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\Agent;
use App\Models\Expense;
use App\Models\User;
use App\Services\Audit;
use App\Services\Ledger;
use App\Services\Visibility;

final class ExpenseController
{
    public const CATEGORIES = [
        'Agent Handover', 'Staff Salary', 'Rent', 'Electricity', 'Stationery & Printing',
        'Travel', 'Tea & Refreshments', 'Telephone & Internet', 'Repairs & Maintenance', 'Customer Return', 'Other',
    ];

    /** Office sees every expense; collection staff see only their own debits. */
    public static function visible(): array
    {
        return Visibility::office() ? Expense::all() : Expense::forStaff(Auth::id());
    }

    public static function index(Request $req): array
    {
        return self::visible();
    }

    /**
     * Office users enter any expense (optionally booked to a staff member). Collection
     * staff enter their own debits (expense / return) from the app; those are always
     * booked to themselves and dated today.
     */
    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager', 'staff');
        $isStaff = Auth::is('staff');
        $in = $req->input();
        $date = $isStaff ? date('Y-m-d') : $in->date('date', true);
        $category = $in->enum('category', self::CATEGORIES);
        $amount = $in->num('amount', true, 1);
        $mode = $in->enum('paymentMode', ['cash', 'bank']);
        $agentId = $in->id('agentId');
        $staffId = $isStaff ? Auth::id() : $in->id('staffId');
        $remarks = $in->str('remarks');
        if ($category === 'Agent Handover' && $agentId === null) {
            $in->error('agentId', 'Select the agent the money was handed over to');
        }
        if ($agentId !== null && Agent::record($agentId) === null) {
            $in->error('agentId', 'Agent not found');
        }
        if (!$isStaff && $staffId !== null && (User::record($staffId)['role'] ?? '') !== 'staff') {
            $in->error('staffId', 'Choose a collection staff member');
        }
        $in->validate();
        Ledger::assertDayOpen($date);

        $number = DB::transaction(function () use ($date, $category, $amount, $mode, $agentId, $staffId, $remarks) {
            $number = Expense::nextCode('expense_no', 'EXP', 6);
            Expense::create([
                'expense_no' => $number,
                'expense_date' => $date,
                'category' => $category,
                'amount' => $amount,
                'payment_mode' => $mode,
                'agent_id' => $agentId,
                'staff_id' => $staffId,
                'remarks' => $remarks,
                'created_by' => Auth::id(),
            ]);
            if ($mode === 'cash') {
                Ledger::cash($date, $number, self::describe($category, $agentId, $remarks), $amount, 0, 'expense');
            }
            Audit::log('Expense Entered', 'Expenses', $number, '-', Audit::money($amount));
            return $number;
        });
        return ['expenseNo' => $number];
    }

    /** MD/Admin remove a wrong entry; a cash expense gets a reversing cash-book entry today. */
    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $e = Expense::recordOrFail($id);
        $today = date('Y-m-d');
        Ledger::assertDayOpen($e['expense_date']);
        Ledger::assertDayOpen($today);

        DB::transaction(function () use ($e, $id, $today) {
            if ($e['payment_mode'] === 'cash') {
                Ledger::cash($today, $e['expense_no'], "Expense deleted - {$e['category']}", 0, (float) $e['amount'], 'expense');
            }
            Expense::delete($id);
            Audit::log('Expense Deleted', 'Expenses', $e['expense_no'], Audit::money((float) $e['amount']), '-');
        });
        return ['ok' => true];
    }

    private static function describe(string $category, ?int $agentId, string $remarks): string
    {
        $agent = $agentId !== null ? (Agent::record($agentId)['name'] ?? '') : '';
        $text = $category . ($agent !== '' ? " - $agent" : '') . ($remarks !== '' ? " ($remarks)" : '');
        return mb_substr($text, 0, 255);
    }
}
