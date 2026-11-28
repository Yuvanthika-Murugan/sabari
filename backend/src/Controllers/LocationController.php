<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\StaffLocation;
use App\Services\Visibility;

/** Live position of collection staff, reported by the staff app while it is open. */
final class LocationController
{
    public static function index(Request $req): array
    {
        return Visibility::officeOnly(StaffLocation::all());
    }

    public static function store(Request $req): array
    {
        $point = self::point($req->body) ?? throw HttpException::unprocessable('A valid latitude and longitude are required');
        StaffLocation::save(Auth::id(), $point[0], $point[1], $point[2]);
        return ['ok' => true];
    }

    /**
     * [lat, lng, accuracy metres] from a request body, or null when absent / out of range.
     * Coordinates can be negative, so they are read here rather than with Input::num().
     */
    public static function point(array $body): ?array
    {
        $lat = $body['latitude'] ?? null;
        $lng = $body['longitude'] ?? null;
        if (!is_numeric($lat) || !is_numeric($lng)) {
            return null;
        }
        $lat = (float) $lat;
        $lng = (float) $lng;
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            return null;
        }
        $acc = $body['accuracy'] ?? null;
        $acc = is_numeric($acc) && $acc >= 0 ? (int) min((float) $acc, 4_000_000_000) : null;
        return [round($lat, 7), round($lng, 7), $acc];
    }
}
