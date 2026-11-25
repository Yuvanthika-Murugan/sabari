<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\DB;
use App\Core\HttpException;

/**
 * Blocks password guessing. Failed sign-ins are recorded per IP address and email:
 * - the same email from the same IP is locked after MAX_PER_ACCOUNT failures, and
 * - one IP is locked after MAX_PER_IP failures across all emails,
 * each for WINDOW_MINUTES after the latest failure. A successful sign-in clears that
 * account's failures from that IP. Locking per email+IP (not per email alone) stops
 * an attacker from locking a real user out of their account from elsewhere.
 */
final class LoginThrottle
{
    private const MAX_PER_ACCOUNT = 5;
    private const MAX_PER_IP = 20;
    private const WINDOW_MINUTES = 15;

    /** Throws 429 when this IP (or this IP + email) is locked. */
    public static function assertAllowed(string $email): void
    {
        $ip = self::ip();
        $since = self::since();
        $forAccount = (int) DB::value('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND email = ? AND attempted_at > ?', [$ip, $email, $since]);
        $forIp = (int) DB::value('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > ?', [$ip, $since]);
        if ($forAccount >= self::MAX_PER_ACCOUNT || $forIp >= self::MAX_PER_IP) {
            $latest = (string) DB::value('SELECT MAX(attempted_at) FROM login_attempts WHERE ip = ?', [$ip]);
            $wait = max(1, (int) ceil((strtotime($latest) + self::WINDOW_MINUTES * 60 - time()) / 60));
            throw new HttpException(429, "Too many failed sign-in attempts. Please try again in $wait minute" . ($wait === 1 ? '' : 's') . '.');
        }
    }

    public static function failed(string $email): void
    {
        DB::exec('INSERT INTO login_attempts (ip, email, attempted_at) VALUES (?, ?, ?)', [self::ip(), mb_substr($email, 0, 160), date('Y-m-d H:i:s')]);
        // Keep the table small.
        DB::exec('DELETE FROM login_attempts WHERE attempted_at < ?', [date('Y-m-d H:i:s', time() - 86400)]);
    }

    public static function succeeded(string $email): void
    {
        DB::exec('DELETE FROM login_attempts WHERE ip = ? AND email = ?', [self::ip(), $email]);
    }

    /** The client address as seen by this server. X-Forwarded-For is ignored: clients can forge it. */
    private static function ip(): string
    {
        return mb_substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45);
    }

    private static function since(): string
    {
        return date('Y-m-d H:i:s', time() - self::WINDOW_MINUTES * 60);
    }
}
