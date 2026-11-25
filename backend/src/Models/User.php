<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** Staff accounts: MD, admins, managers and collection staff. */
final class User extends Model
{
    protected const TABLE = 'users';
    protected const LABEL = 'User';
    protected const SELECT = "SELECT CAST(id AS CHAR) AS id, emp_id AS empId, name, phone, email, role,
        COALESCE(CAST(branch_id AS CHAR), '') AS branchId, address, status,
        COALESCE(DATE_FORMAT(joining_date, '%Y-%m-%d'), '') AS joiningDate, monthly_target AS monthlyTarget,
        monthly_salary AS monthlySalary, photo_path AS photo
        FROM users";
    protected const ORDER = ' ORDER BY id';
    protected const FLOATS = ['monthlyTarget', 'monthlySalary'];

    /** The fields needed to check a sign-in. */
    public static function forLogin(string $email): ?array
    {
        return DB::one('SELECT id, name, role, password_hash, status FROM users WHERE email = ?', [$email]);
    }

    public static function emailTaken(string $email, int $ignoreId = 0): bool
    {
        return self::exists('email = ? AND id <> ?', [$email, $ignoreId]);
    }

    public static function passwordMatches(int $id, string $password): bool
    {
        return password_verify($password, (string) DB::value('SELECT password_hash FROM users WHERE id = ?', [$id]));
    }

    public static function setPassword(int $id, string $password): void
    {
        self::update($id, ['password_hash' => self::hash($password)]);
    }

    public static function hash(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT);
    }

    public static function name(int $id): ?string
    {
        return DB::value('SELECT name FROM users WHERE id = ?', [$id]);
    }
}
