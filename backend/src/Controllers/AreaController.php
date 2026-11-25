<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Input;
use App\Core\Request;
use App\Models\Area;
use App\Models\Customer;
use App\Services\Audit;

/** Collection areas within a branch. Customers reference an area by name. */
final class AreaController
{
    public static function index(Request $req): array
    {
        return Area::all();
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $data = self::validated($req->input());
        self::assertUnique($data);
        $data['code'] = Area::nextCode('code', 'AREA', 3);
        $id = Area::create($data);
        Audit::log('Area Created', 'Areas', $data['code'], '-', $data['name']);
        return Area::find($id);
    }

    public static function update(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $existing = Area::find($id);
        $data = self::validated($req->input());
        self::assertUnique($data, $id);
        DB::transaction(function () use ($data, $id, $existing) {
            Area::update($id, $data);
            // Keep customers pointing at the renamed area.
            if ($data['name'] !== $existing['name'] || (string) $data['branch_id'] !== $existing['branchId']) {
                Customer::renameArea($existing['name'], $data['name'], (int) $existing['branchId']);
            }
        });
        Audit::log('Area Updated', 'Areas', $existing['code'], $existing['name'], $data['name']);
        return Area::find($id);
    }

    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $area = Area::find($id);
        if (Customer::inArea($area['name'], (int) $area['branchId'])) {
            throw new HttpException(409, 'Customers are assigned to this area. Move them or set the area to Inactive instead.');
        }
        Area::delete($id);
        Audit::log('Area Deleted', 'Areas', $area['code'], $area['name'], '-');
        return ['ok' => true];
    }

    private static function validated(Input $in): array
    {
        $data = [
            'name' => $in->str('name', true, 120),
            'branch_id' => $in->id('branchId', true),
            'staff_id' => $in->id('staffId'),
            'pincode' => $in->pincode('pincode'),
            'status' => $in->enum('status', ['active', 'inactive'], 'active'),
        ];
        $in->validate();
        return $data;
    }

    private static function assertUnique(array $data, int $ignoreId = 0): void
    {
        if (Area::nameTaken($data['name'], $data['branch_id'], $ignoreId)) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['name' => 'This branch already has an area with this name']);
        }
    }
}
