<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Models\AuditLog;

final class AuditController
{
    /** The audit trail is for office roles only; collection staff get an empty list. */
    public static function rows(): array
    {
        return Auth::is('md', 'admin', 'manager') ? AuditLog::all() : [];
    }

    public static function index(Request $req): array
    {
        return self::rows();
    }
}
