<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** In-app notifications, shared by all users. */
final class Notification extends Model
{
    protected const TABLE = 'notifications';
    protected const SELECT = "SELECT CAST(id AS CHAR) AS id, type, title, message, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS time, is_read AS `read`
        FROM notifications";
    protected const ORDER = ' ORDER BY created_at DESC, id DESC LIMIT 200';
    protected const BOOLS = ['read'];

    public static function markRead(int $id): void
    {
        self::update($id, ['is_read' => 1]);
    }

    public static function markAllRead(): void
    {
        DB::exec('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    }
}
