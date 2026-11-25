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

    /** Rows only office roles may see (bank/cash books, vouchers, withdrawals, day end). */
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

    /** Staff may pick an account for a bank/UPI payment, but never see balances or full numbers. */
    public static function bankAccounts(array $accounts): array
    {
        if (self::office()) {
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

    /** Staff do not see company cash and bank balances. */
    public static function dashboard(array $data): array
    {
        if (!self::office()) {
            $data['stats']['cashBalance'] = 0;
            $data['stats']['bankBalance'] = 0;
        }
        return $data;
    }
}
