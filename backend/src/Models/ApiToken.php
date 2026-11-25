<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\DB;

/** Sign-in sessions. Only a SHA-256 hash of each bearer token is stored. */
final class ApiToken extends Model
{
    protected const TABLE = 'api_tokens';

    /** Creates a session for the user and returns the plain token (shown to the client once). */
    public static function issue(int $userId, int $ttlHours): string
    {
        $token = bin2hex(random_bytes(32));
        DB::exec('DELETE FROM api_tokens WHERE expires_at < NOW()');
        self::create([
            'user_id' => $userId,
            'token_hash' => self::hash($token),
            'expires_at' => date('Y-m-d H:i:s', time() + $ttlHours * 3600),
        ]);
        return $token;
    }

    /** The signed-in user for an unexpired token, or null. */
    public static function userFor(string $token): ?array
    {
        return DB::one(
            "SELECT u.id, u.name, u.role, u.branch_id, u.status
             FROM api_tokens t JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = ? AND t.expires_at > NOW()",
            [self::hash($token)]
        );
    }

    public static function revoke(string $token): void
    {
        DB::exec('DELETE FROM api_tokens WHERE token_hash = ?', [self::hash($token)]);
    }

    /** Signs the user out everywhere, optionally keeping one session. */
    public static function revokeAllFor(int $userId, ?string $exceptToken = null): void
    {
        DB::exec('DELETE FROM api_tokens WHERE user_id = ? AND token_hash <> ?', [$userId, $exceptToken === null ? '' : self::hash($exceptToken)]);
    }

    private static function hash(string $token): string
    {
        return hash('sha256', $token);
    }
}
