<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Auth;

/**
 * What each role may read. Office roles (MD, admin, manager) see everything;
 * collection staff see only what their screens need. Every read endpoint and
 * /bootstrap pass their rows through here so the two can never disagree.
 */
final class Visibility
{
    public static function office(): bool
    {
        return Auth::is('md', 'admin', 'manager');
    }

    /** The admin panel: MD and admin. Managers do not see company cash/bank books, day end or the audit trail. */
    public static function admin(): bool
    {
        return Auth::is('md', 'admin');
    }

    /** Rows only MD / admin may see (cash and bank books, day end, audit log). */
    public static function adminOnly(array $rows): array
    {
        return self::admin() ? $rows : [];
    }

    /** Rows only office roles may see (vouchers, withdrawals, staff locations). */
    public static function officeOnly(array $rows): array
    {
        return self::office() ? $rows : [];
    }

    /** Staff see colleagues' names only; contact details, salaries and targets are hidden. */
    public static function users(array $users): array
    {
        if (self::office()) {
            return $users;
        }
        $me = Auth::id();
        return array_map(fn (array $u) => (int) $u['id'] === $me ? $u : [
            'id' => $u['id'], 'empId' => $u['empId'], 'name' => $u['name'], 'phone' => '', 'email' => '',
            'role' => $u['role'], 'branchId' => $u['branchId'], 'address' => '', 'status' => $u['status'],
            'joiningDate' => '', 'monthlyTarget' => 0, 'monthlySalary' => 0, 'photo' => $u['photo'] ?? null,
        ], $users);
    }

    /** Others may pick an account for a bank/UPI payment, but only MD / admin see balances and full numbers. */
    public static function bankAccounts(array $accounts): array
    {
        if (self::admin()) {
            return $accounts;
        }
        return array_map(fn (array $a) => [
            'id' => $a['id'], 'bankName' => $a['bankName'], 'accountName' => $a['accountName'],
            'accountNumber' => 'XXXX' . substr((string) $a['accountNumber'], -4), 'branch' => $a['branch'],
            'ifsc' => '', 'openingBalance' => 0, 'currentBalance' => 0, 'status' => $a['status'],
        ], $accounts);
    }

    /** Staff do not see other employees' salary payments. */
    public static function payments(array $payments): array
    {
        if (self::office()) {
            return $payments;
        }
        $me = (string) Auth::id();
        return array_values(array_filter($payments, fn (array $p) => $p['employeeId'] === '' || $p['employeeId'] === $me));
    }

    /** Only MD / admin see company cash and bank balances and expenses. */
    public static function dashboard(array $data): array
    {
        if (!self::admin()) {
            foreach (['cashBalance', 'bankBalance', 'cashCollected', 'bankCollected', 'cashExpense', 'bankExpense', 'expenseTotal', 'todayExpense', 'totalCash', 'totalBank'] as $key) {
                $data['stats'][$key] = 0;
            }
        }
        return $data;
    }
}
