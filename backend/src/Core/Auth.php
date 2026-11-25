<?php

declare(strict_types=1);

namespace App\Core;

use App\Models\ApiToken;

/** Bearer-token authentication. Tokens are stored hashed in api_tokens. */
final class Auth
{
    private static ?array $user = null;
    private static int $ttlHours = 12;

    public static function configure(array $config): void
    {
        self::$ttlHours = (int) ($config['token_ttl_hours'] ?? 12);
    }

    public static function issueToken(int $userId): string
    {
        return ApiToken::issue($userId, self::$ttlHours);
    }

    public static function revoke(Request $request): void
    {
        $token = $request->bearerToken();
        if ($token) {
            ApiToken::revoke($token);
        }
    }

    public static function authenticate(Request $request): void
    {
        $token = $request->bearerToken();
        if (!$token) {
            throw new HttpException(401, 'Authentication required');
        }
        $user = ApiToken::userFor($token);
        if (!$user || $user['status'] !== 'active') {
            throw new HttpException(401, 'Your session has expired. Please sign in again.');
        }
        self::$user = $user;
    }

    public static function user(): array
    {
        if (self::$user === null) {
            throw new HttpException(401, 'Authentication required');
        }
        return self::$user;
    }

    public static function id(): int
    {
        return (int) self::user()['id'];
    }

    public static function role(): string
    {
        return self::user()['role'];
    }

    public static function is(string ...$roles): bool
    {
        return in_array(self::role(), $roles, true);
    }

    public static function requireRole(string ...$roles): void
    {
        if (!self::is(...$roles)) {
            throw HttpException::forbidden();
        }
    }
}
