<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Models\Agent;
use App\Models\Area;
use App\Models\Auction;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\Branch;
use App\Models\CashTransaction;
use App\Models\ChitGroup;
use App\Models\ChitGroupCode;
use App\Models\Collection;
use App\Models\Customer;
use App\Models\CustomerTransfer;
use App\Models\DashboardReport;
use App\Models\DayEndClosing;
use App\Models\DueSchedule;
use App\Models\StaffLocation;
use App\Models\Notification;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Models\Voucher;
use App\Models\Withdrawal;
use App\Services\Visibility;

/** Everything the single-page app needs after sign-in, in one request. */
final class BootstrapController
{
    public static function index(Request $req): array
    {
        return [
            'users' => Visibility::users(User::all()),
            'branches' => Branch::all(),
            'groups' => ChitGroup::all(),
            'groupCodes' => ChitGroupCode::all(),
            'areas' => Area::all(),
            'agents' => Agent::all(),
            'customers' => Customer::all(),
            'dueSchedules' => DueSchedule::all(),
            'customerTransfers' => CustomerTransfer::all(),
            'collections' => Collection::valid(),
            'cancelledReceipts' => Collection::cancelled(),
            'auctions' => Auction::all(),
            'bidPayments' => BidPaymentController::visible(),
            'paymentApprovals' => Visibility::payments(Payment::all()),
            'vouchers' => Visibility::officeOnly(Voucher::all()),
            'expenses' => ExpenseController::visible(),
            'cashHandovers' => HandoverController::visible(),
            'settlements' => SettlementController::visible(),
            'staffLocations' => Visibility::officeOnly(StaffLocation::all()),
            'withdrawals' => Visibility::officeOnly(Withdrawal::all()),
            'bankAccounts' => Visibility::bankAccounts(BankAccount::all()),
            'bankTransactions' => Visibility::adminOnly(BankTransaction::all()),
            'cashTransactions' => Visibility::adminOnly(CashTransaction::all()),
            'notifications' => Notification::all(),
            'auditLogs' => AuditController::rows(),
            'dayEndClosings' => Visibility::adminOnly(DayEndClosing::all()),
            'dashboard' => Visibility::dashboard(DashboardReport::data()),
            'settings' => Setting::company(),
            'commission' => Setting::commission(),
            'today' => date('Y-m-d'),
        ];
    }
}
