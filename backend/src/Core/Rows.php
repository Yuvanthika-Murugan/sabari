<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Casts DECIMAL/TINYINT columns (returned as strings by PDO) to JSON numbers
 * and booleans. IDs are deliberately kept as strings for the frontend.
 */
final class Rows
{
    public static function cast(array $rows, array $floats = [], array $ints = [], array $bools = []): array
    {
        foreach ($rows as &$row) {
            foreach ($floats as $k) {
                $row[$k] = (float) $row[$k];
            }
            foreach ($ints as $k) {
                $row[$k] = (int) $row[$k];
            }
            foreach ($bools as $k) {
                $row[$k] = (bool) $row[$k];
            }
        }
        return $rows;
    }
}
