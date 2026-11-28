<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** Latest phone position of each collection staff member (one row per user). */
final class StaffLocation extends Model
{
    protected const TABLE = 'staff_locations';
    protected const LABEL = 'Location';
    protected const SELECT = "SELECT CAST(l.user_id AS CHAR) AS userId, u.name, u.role,
        l.latitude, l.longitude, l.accuracy, DATE_FORMAT(l.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt,
        TIMESTAMPDIFF(MINUTE, l.updated_at, NOW()) AS minutesAgo
        FROM staff_locations l JOIN users u ON u.id = l.user_id";
    protected const KEY = 'l.user_id';
    protected const ORDER = ' ORDER BY l.updated_at DESC';
    protected const FLOATS = ['latitude', 'longitude'];
    protected const INTS = ['accuracy', 'minutesAgo'];

    public static function save(int $userId, float $lat, float $lng, ?int $accuracy): void
    {
        DB::exec(
            'INSERT INTO staff_locations (user_id, latitude, longitude, accuracy) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude),
                                     accuracy = VALUES(accuracy), updated_at = CURRENT_TIMESTAMP',
            [$userId, $lat, $lng, $accuracy]
        );
    }
}
