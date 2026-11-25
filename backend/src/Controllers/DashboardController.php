<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Models\DashboardReport;
use App\Services\Visibility;

final class DashboardController
{
    public static function index(Request $req): array
    {
        return Visibility::dashboard(DashboardReport::data());
    }
}
