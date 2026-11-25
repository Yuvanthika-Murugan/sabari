<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Auth;
use App\Models\AuditLog;

final class Audit
{
    private const ROLE_LABELS = ['md' => 'MD', 'admin' => 'Admin', 'manager' => 'Manager', 'staff' => 'Staff'];

    public static function log(string $action, string $module, string $recordId, string $old = '-', string $new = '-'): void
    {
        $user = Auth::user();
        AuditLog::create([
            'user_id' => $user['id'],
            'user_name' => $user['name'],
            'role' => self::ROLE_LABELS[$user['role']] ?? $user['role'],
            'action' => $action,
            'module' => $module,
            'record_id' => $recordId,
            'old_value' => mb_substr($old, 0, 255),
            'new_value' => mb_substr($new, 0, 255),
        ]);
    }

    /** Records a sign-in attempt; runs before the request is authenticated. */
    public static function login(?array $user, string $email, string $action): void
    {
        AuditLog::create([
            'user_id' => $user['id'] ?? null,
            'user_name' => $user['name'] ?? $email,
            'role' => $user ? (self::ROLE_LABELS[$user['role']] ?? $user['role']) : '-',
            'action' => $action,
            'module' => 'Login',
            'record_id' => mb_substr($email, 0, 60),
            'new_value' => mb_substr($_SERVER['REMOTE_ADDR'] ?? '-', 0, 255),
        ]);
    }

    public static function money(float $amount): string
    {
        return '₹' . number_format($amount, 0);
    }
}
