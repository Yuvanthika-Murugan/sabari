<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Input;
use App\Core\Request;
use App\Models\BankAccount;
use App\Models\BankTransaction;
use App\Models\CashTransaction;
use App\Services\Audit;
use App\Services\Visibility;

final class BankController
{
    public static function accounts(Request $req): array
    {
        return Visibility::bankAccounts(BankAccount::all());
    }

    public static function transactions(Request $req): array
    {
        return Visibility::adminOnly(BankTransaction::all());
    }

    public static function cash(Request $req): array
    {
        return Visibility::adminOnly(CashTransaction::all());
    }

    public static function storeAccount(Request $req): array
    {
        Auth::requireRole('md', 'admin');
        $in = $req->input();
        $data = [
            'bank_name' => $in->str('bankName', true, 120),
            'account_name' => $in->name('accountName', true, 160),
            'account_number' => self::accountNumber($in),
            'branch' => $in->str('branch', true, 120),
            'ifsc' => self::ifsc($in),
            'opening_balance' => $in->num('openingBalance', true),
        ];
        $in->validate();
        if (BankAccount::numberTaken($data['account_number'])) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['accountNumber' => 'This account already exists']);
        }

        $id = BankAccount::create($data + ['current_balance' => $data['opening_balance']]);
        Audit::log('Bank Account Added', 'Bank Accounts', $data['account_number'], '-', $data['bank_name']);
        return ['id' => (string) $id];
    }

    /** Edits an account's details and status. Balances only change through transactions. */
    public static function updateAccount(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $existing = BankAccount::recordOrFail($id);
        $in = $req->input();
        $data = [
            'bank_name' => $in->str('bankName', true, 120),
            'account_name' => $in->name('accountName', true, 160),
            'account_number' => self::accountNumber($in),
            'branch' => $in->str('branch', true, 120),
            'ifsc' => self::ifsc($in),
            'status' => $in->enum('status', ['active', 'inactive'], 'active'),
        ];
        $in->validate();
        if (BankAccount::numberTaken($data['account_number'], $id)) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['accountNumber' => 'This account already exists']);
        }
        if ($data['account_number'] !== $existing['account_number'] && BankTransaction::existsFor($id)) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['accountNumber' => 'This account has transactions; its number cannot be changed']);
        }

        BankAccount::update($id, $data);
        Audit::log('Bank Account Updated', 'Bank Accounts', $data['account_number'],
            "{$existing['bank_name']} ({$existing['status']})", "{$data['bank_name']} ({$data['status']})");
        return ['ok' => true];
    }

    /** Indian bank account numbers are 9 to 18 digits. */
    private static function accountNumber(Input $in): string
    {
        return $in->pattern('accountNumber', '/^\d{9,18}$/', 'Account number must be 9 to 18 digits', true, 40);
    }

    /** IFSC: 4 bank letters, a zero, then 6 letters/digits (e.g. HDFC0001234). */
    private static function ifsc(Input $in): string
    {
        return $in->pattern('ifsc', '/^[A-Z]{4}0[A-Z0-9]{6}$/', 'Must be a valid IFSC (e.g. HDFC0001234)', true, 20);
    }
}
