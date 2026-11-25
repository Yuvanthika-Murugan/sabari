<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Input;

/** Rules every new password must meet (user creation, admin reset, self change). */
final class PasswordPolicy
{
    public const MIN_LENGTH = 8;

    /** Passwords so common that they are guessed first. */
    private const COMMON = [
        'password', 'password1', 'password123', 'passw0rd', '12345678', '123456789', '1234567890',
        'qwerty123', 'qwertyuiop', 'abc12345', 'abcd1234', 'admin123', 'admin@123', 'welcome1',
        'welcome123', 'letmein1', 'iloveyou', '11111111', '00000000', 'fincollect', 'fincollect1',
        'fincollect123', 'india123', 'chennai123',
    ];

    /** Records an error on $key when $password breaks a rule. Returns the password unchanged. */
    public static function check(Input $in, string $key, string $password, string $email = ''): string
    {
        if ($password === '') {
            return $password; // "required" is reported by the caller
        }
        $error = match (true) {
            mb_strlen($password) < self::MIN_LENGTH => 'Must be at least ' . self::MIN_LENGTH . ' characters',
            mb_strlen($password) > 128 => 'Must be at most 128 characters',
            !preg_match('/\pL/u', $password) || !preg_match('/\d/', $password) => 'Must contain at least one letter and one number',
            in_array(mb_strtolower($password), self::COMMON, true) => 'This password is too common. Choose another.',
            $email !== '' && stripos($password, (string) strstr($email, '@', true)) !== false && strlen((string) strstr($email, '@', true)) >= 3
                => 'Must not contain your email name',
            default => null,
        };
        if ($error) {
            $in->error($key, $error);
        }
        return $password;
    }
}
