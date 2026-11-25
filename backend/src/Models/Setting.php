<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** Key/value company settings and commission rules. */
final class Setting extends Model
{
    protected const TABLE = 'settings';

    /** Company details: stored key => API field. */
    public const COMPANY = [
        'company_name' => 'companyName',
        'gst_number' => 'gstNumber',
        'currency' => 'currency',
        'fy_start' => 'fyStart',
        'company_address' => 'companyAddress',
        // Shown as a payment QR on the staff collection screen.
        'upi_id' => 'upiId',
        'upi_payee_name' => 'upiPayeeName',
    ];

    /** Commission and auction rules (percentages): stored key => [API field, default]. */
    public const COMMISSION = [
        'foreman_commission_pct' => ['foremanCommissionPct', 5.0],
        'max_bid_pct' => ['maxBidPct', 40.0],
        'agent_commission_pct' => ['agentCommissionPct', 2.0],
    ];

    /** Every stored setting, key => value. */
    public static function values(): array
    {
        return array_column(DB::all('SELECT setting_key, setting_value FROM settings'), 'setting_value', 'setting_key');
    }

    public static function put(string $key, string $value): void
    {
        DB::exec('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [$key, $value]);
    }

    public static function company(): array
    {
        $stored = self::values();
        $out = [];
        foreach (self::COMPANY as $key => $field) {
            $out[$field] = $stored[$key] ?? '';
        }
        return $out;
    }

    public static function commission(): array
    {
        $stored = self::values();
        $out = [];
        foreach (self::COMMISSION as $key => [$field, $default]) {
            $out[$field] = isset($stored[$key]) ? (float) $stored[$key] : $default;
        }
        return $out;
    }

    /** One commission rule by its API field name, e.g. rate('foremanCommissionPct'). */
    public static function rate(string $field): float
    {
        return self::commission()[$field];
    }
}
