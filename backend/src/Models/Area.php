<?php

declare(strict_types=1);

namespace App\Models;

/** Collection areas within a branch. Customers reference an area by name. */
final class Area extends Model
{
    protected const TABLE = 'areas';
    protected const LABEL = 'Area';
    protected const SELECT = "SELECT CAST(a.id AS CHAR) AS id, a.code, a.name, CAST(a.branch_id AS CHAR) AS branchId,
        COALESCE(CAST(a.staff_id AS CHAR), '') AS staffId, a.pincode, a.status
        FROM areas a";
    protected const KEY = 'a.id';
    protected const ORDER = ' ORDER BY a.code';

    public static function nameTaken(string $name, int $branchId, int $ignoreId = 0): bool
    {
        return self::exists('name = ? AND branch_id = ? AND id <> ?', [$name, $branchId, $ignoreId]);
    }
}
