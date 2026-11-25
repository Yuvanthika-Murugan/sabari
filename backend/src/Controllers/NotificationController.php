<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Models\Notification;

final class NotificationController
{
    public static function index(Request $req): array
    {
        return Notification::all();
    }

    public static function markRead(Request $req, int $id): array
    {
        Notification::markRead($id);
        return ['ok' => true];
    }

    public static function markAllRead(Request $req): array
    {
        Notification::markAllRead();
        return ['ok' => true];
    }

    /** Notifications are shared by everyone, so only office roles may delete them. */
    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        Notification::delete($id);
        return ['ok' => true];
    }
}
