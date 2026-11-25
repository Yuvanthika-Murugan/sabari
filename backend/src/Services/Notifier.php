<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Notification;

final class Notifier
{
    public static function push(string $type, string $title, string $message): void
    {
        Notification::create(['type' => $type, 'title' => $title, 'message' => mb_substr($message, 0, 255)]);
    }
}
