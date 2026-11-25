<?php

declare(strict_types=1);

use App\Controllers\AgentController;
use App\Controllers\AreaController;
use App\Controllers\AuctionController;
use App\Controllers\AuditController;
use App\Controllers\AuthController;
use App\Controllers\BankController;
use App\Controllers\BootstrapController;
use App\Controllers\BranchController;
use App\Controllers\CollectionController;
use App\Controllers\CustomerController;
use App\Controllers\DashboardController;
use App\Controllers\DayEndController;
use App\Controllers\GroupCodeController;
use App\Controllers\GroupController;
use App\Controllers\NotificationController;
use App\Controllers\PaymentController;
use App\Controllers\SettingsController;
use App\Controllers\UserController;
use App\Controllers\VoucherController;
use App\Controllers\WithdrawalController;
use App\Core\Router;

/** Routes that do not require a bearer token. */
const PUBLIC_ROUTES = ['POST /auth/login', 'GET /health', 'GET /public/info'];

return function (Router $r): void {
    $r->get('/health', fn () => ['status' => 'ok']);
    // Landing page: company name/address and active branches' contact details only.
    $r->get('/public/info', [SettingsController::class, 'publicInfo']);

    $r->post('/auth/login', [AuthController::class, 'login']);
    $r->post('/auth/logout', [AuthController::class, 'logout']);
    $r->get('/auth/me', [AuthController::class, 'me']);

    $r->get('/bootstrap', [BootstrapController::class, 'index']);
    $r->get('/dashboard', [DashboardController::class, 'index']);

    $r->resource('/users', UserController::class);
    $r->post('/users/{id}/reset-password', [UserController::class, 'resetPassword']);
    $r->resource('/branches', BranchController::class);
    $r->resource('/groups', GroupController::class);
    $r->resource('/group-codes', GroupCodeController::class);
    $r->resource('/areas', AreaController::class);
    $r->resource('/agents', AgentController::class);

    $r->resource('/customers', CustomerController::class);
    $r->get('/customers/{id}/dues', [CustomerController::class, 'dues']);
    $r->post('/customers/{id}/transfer', [CustomerController::class, 'transfer']);
    $r->get('/customer-transfers', [CustomerController::class, 'transfers']);

    $r->get('/collections', [CollectionController::class, 'index']);
    $r->post('/collections', [CollectionController::class, 'store']);
    $r->post('/collections/{id}/cancel', [CollectionController::class, 'cancel']);

    $r->get('/auctions', [AuctionController::class, 'index']);
    $r->post('/auctions', [AuctionController::class, 'store']);
    $r->post('/auctions/{id}/pay', [AuctionController::class, 'pay']);

    $r->get('/payments', [PaymentController::class, 'index']);
    $r->post('/payments', [PaymentController::class, 'store']);
    $r->post('/payments/{id}/action', [PaymentController::class, 'action']);

    $r->get('/vouchers', [VoucherController::class, 'index']);
    $r->post('/vouchers', [VoucherController::class, 'store']);
    $r->post('/vouchers/{id}/decision', [VoucherController::class, 'decide']);

    $r->get('/withdrawals', [WithdrawalController::class, 'index']);
    $r->post('/withdrawals', [WithdrawalController::class, 'store']);
    $r->post('/withdrawals/{id}/decision', [WithdrawalController::class, 'decide']);

    $r->get('/bank-accounts', [BankController::class, 'accounts']);
    $r->post('/bank-accounts', [BankController::class, 'storeAccount']);
    $r->put('/bank-accounts/{id}', [BankController::class, 'updateAccount']);
    $r->get('/bank-transactions', [BankController::class, 'transactions']);
    $r->get('/cash-transactions', [BankController::class, 'cash']);

    $r->get('/notifications', [NotificationController::class, 'index']);
    $r->post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    $r->post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    $r->delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    $r->get('/audit-logs', [AuditController::class, 'index']);

    $r->get('/day-end', [DayEndController::class, 'index']);
    $r->post('/day-end/{id}/close', [DayEndController::class, 'close']);

    $r->get('/settings', [SettingsController::class, 'index']);
    $r->put('/settings', [SettingsController::class, 'update']);
    $r->get('/settings/commission', [SettingsController::class, 'commission']);
    $r->put('/settings/commission', [SettingsController::class, 'updateCommission']);
    $r->put('/profile', [SettingsController::class, 'updateProfile']);
    $r->put('/profile/password', [SettingsController::class, 'changePassword']);
};
