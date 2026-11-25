<?php

declare(strict_types=1);

namespace App\Models;

final class Branch extends Model
{
    protected const TABLE = 'branches';
    protected const LABEL = 'Branch';
    protected const SELECT = "SELECT CAST(id AS CHAR) AS id, code, name, address, phone,
        COALESCE(CAST(manager_id AS CHAR), '') AS managerId,
        COALESCE(DATE_FORMAT(opening_date, '%Y-%m-%d'), '') AS openingDate, status
        FROM branches";
    protected const ORDER = ' ORDER BY code';

    public static function codeTaken(string $code, int $ignoreId = 0): bool
    {
        return self::exists('code = ? AND id <> ?', [$code, $ignoreId]);
    }
}
