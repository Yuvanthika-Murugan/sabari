<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;
use App\Core\HttpException;
use App\Core\Rows;

/**
 * Base for table models. Each model owns the SQL for one table:
 *
 * - SELECT returns rows shaped for the API (camelCase keys, string ids). all()/find()
 *   run it and cast DECIMAL/INT/BOOL columns listed in FLOATS/INTS/BOOLS.
 * - record()/create()/update()/delete() work on the raw table (snake_case columns)
 *   for controllers and services that need to read or change stored values.
 *
 * Models hold no request or permission logic; that stays in the controllers.
 */
abstract class Model
{
    protected const TABLE = '';
    /** API-shaped read query, without WHERE/ORDER. */
    protected const SELECT = '';
    /** The id column as written inside SELECT, e.g. "g.id" when the table is aliased. */
    protected const KEY = 'id';
    protected const ORDER = '';
    protected const FLOATS = [];
    protected const INTS = [];
    protected const BOOLS = [];
    /** Used in "… not found" errors. */
    protected const LABEL = 'Record';

    // ----- API-shaped reads -------------------------------------------------

    public static function all(): array
    {
        return static::query();
    }

    public static function find(int $id): array
    {
        return static::findOrNull($id) ?? throw HttpException::notFound(static::LABEL);
    }

    public static function findOrNull(int $id): ?array
    {
        return static::query(static::KEY . ' = ?', [$id])[0] ?? null;
    }

    /** Runs SELECT with an optional WHERE clause and the model's ORDER. */
    protected static function query(string $where = '', array $params = []): array
    {
        $sql = static::SELECT . ($where !== '' ? " WHERE $where" : '') . static::ORDER;
        return static::shape(DB::all($sql, $params));
    }

    protected static function shape(array $rows): array
    {
        return Rows::cast($rows, static::FLOATS, static::INTS, static::BOOLS);
    }

    // ----- Raw table access -------------------------------------------------

    /** The stored row, or null. $lock takes a row lock for the rest of the transaction. */
    public static function record(int $id, bool $lock = false): ?array
    {
        return DB::one('SELECT * FROM ' . static::TABLE . ' WHERE id = ?' . ($lock ? ' FOR UPDATE' : ''), [$id]);
    }

    public static function recordOrFail(int $id): array
    {
        return static::record($id) ?? throw HttpException::notFound(static::LABEL);
    }

    public static function create(array $data): int
    {
        return DB::insert(static::TABLE, $data);
    }

    public static function update(int $id, array $data): void
    {
        DB::update(static::TABLE, $data, $id);
    }

    public static function delete(int $id): void
    {
        DB::exec('DELETE FROM ' . static::TABLE . ' WHERE id = ?', [$id]);
    }

    /** Whether any row matches the condition, e.g. exists('code = ? AND id <> ?', [$code, $id]). */
    public static function exists(string $where, array $params = []): bool
    {
        return (bool) DB::value('SELECT 1 FROM ' . static::TABLE . " WHERE $where LIMIT 1", $params);
    }

    /** Next sequential code in a column, e.g. nextCode('group_code', 'GRP', 3) => GRP005. */
    public static function nextCode(string $column, string $prefix, int $pad): string
    {
        return DB::nextCode(static::TABLE, $column, $prefix, $pad);
    }
}
