<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

/** Thin static wrapper around a single PDO connection. */
final class DB
{
    private static ?PDO $pdo = null;
    private static array $config = [];
    /** Named MySQL locks taken by nextCode(), released when the transaction ends. */
    private static array $codeLocks = [];

    public static function configure(array $config): void
    {
        self::$config = $config;
    }

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $c = self::$config;
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], $c['port'], $c['name']);
            self::$pdo = new PDO($dsn, $c['user'], $c['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
            if (!empty($c['timezone'])) {
                self::$pdo->exec("SET time_zone = " . self::$pdo->quote($c['timezone']));
            }
        }
        return self::$pdo;
    }

    public static function all(string $sql, array $params = []): array
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public static function value(string $sql, array $params = []): mixed
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        $value = $stmt->fetchColumn();
        return $value === false ? null : $value;
    }

    public static function exec(string $sql, array $params = []): int
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    public static function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $cols),
            implode(', ', array_map(fn ($c) => ':' . $c, $cols))
        );
        self::exec($sql, $data);
        return (int) self::pdo()->lastInsertId();
    }

    public static function update(string $table, array $data, int $id): int
    {
        if (!$data) {
            return 0;
        }
        $set = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($data)));
        return self::exec("UPDATE $table SET $set WHERE id = :__id", $data + ['__id' => $id]);
    }

    /** Runs $fn inside a transaction and returns its result. */
    public static function transaction(callable $fn): mixed
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $result = $fn();
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        } finally {
            self::releaseCodeLocks();
        }
    }

    private static function releaseCodeLocks(): void
    {
        foreach (array_keys(self::$codeLocks) as $name) {
            self::value('SELECT RELEASE_LOCK(:name)', ['name' => $name]);
        }
        self::$codeLocks = [];
    }

    /**
     * Next sequential code such as RCP000206, based on the highest existing one.
     *
     * Two requests saving at the same moment must not get the same code, so the
     * caller holds a named lock on the code column until its transaction commits
     * (call this inside DB::transaction). The read is a locking read so it sees
     * rows committed by the request that held the lock before.
     */
    public static function nextCode(string $table, string $column, string $prefix, int $pad): string
    {
        $lock = "nextcode:$table.$column";
        if (!isset(self::$codeLocks[$lock])) {
            if ((int) self::value('SELECT GET_LOCK(:name, 15)', ['name' => $lock]) !== 1) {
                throw new HttpException(503, 'The server is busy saving another record. Please try again.');
            }
            self::$codeLocks[$lock] = true;
        }
        $max = (int) self::value(
            "SELECT COALESCE(MAX(CAST(SUBSTRING($column, :start) AS UNSIGNED)), 0) FROM $table WHERE $column LIKE :prefix LOCK IN SHARE MODE",
            ['start' => strlen($prefix) + 1, 'prefix' => $prefix . '%']
        );
        return $prefix . str_pad((string) ($max + 1), $pad, '0', STR_PAD_LEFT);
    }
}
