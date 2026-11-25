<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Input;
use App\Core\Request;
use App\Models\Branch;
use App\Services\Audit;

final class BranchController
{
    public static function index(Request $req): array
    {
        return Branch::all();
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin');
        $data = self::validated($req->input());
        self::assertUnique($data['code']);
        $id = Branch::create($data);
        Audit::log('Branch Created', 'Branches', $data['code'], '-', $data['name']);
        return Branch::find($id);
    }

    public static function update(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $existing = Branch::find($id);
        $data = self::validated($req->input());
        self::assertUnique($data['code'], $id);
        Branch::update($id, $data);
        Audit::log('Branch Updated', 'Branches', $data['code'], $existing['name'], $data['name']);
        return Branch::find($id);
    }

    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $branch = Branch::find($id);
        Branch::delete($id);
        Audit::log('Branch Deleted', 'Branches', $branch['code'], $branch['name'], '-');
        return ['ok' => true];
    }

    private static function validated(Input $in): array
    {
        $data = [
            'code' => $in->pattern('code', '/^[A-Z0-9\/-]+$/', 'Use letters, digits, - and / only', true, 20),
            'name' => $in->str('name', true, 120),
            'phone' => $in->phone('phone', true),
            'manager_id' => $in->id('managerId'),
            'opening_date' => $in->date('openingDate', true),
            'status' => $in->enum('status', ['active', 'inactive'], 'active'),
            'address' => $in->str('address'),
        ];
        $in->validate();
        return $data;
    }

    private static function assertUnique(string $code, int $ignoreId = 0): void
    {
        if (Branch::codeTaken($code, $ignoreId)) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['code' => 'This branch code is already in use']);
        }
    }
}
