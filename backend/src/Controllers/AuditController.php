<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Models\AuditLog;

final class AuditController
{
    /** The audit trail is for MD / admin only; everyone else gets an empty list. */
    public static function rows(): array
    {
        return Auth::is('md', 'admin') ? AuditLog::all() : [];
    }

    public static function index(Request $req): array
    {
        return self::rows();
    }
}
