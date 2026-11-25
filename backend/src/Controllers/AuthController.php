<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\User;
use App\Services\Audit;
use App\Services\LoginThrottle;

final class AuthController
{
    /** bcrypt hash of a random string nobody knows; only used to equalise timing. */
    private const DUMMY_HASH = '$2y$10$EGlii8zNbkWeUUiV64iiouYPKRXqKUUD66JdgbCFtP6G5zaRO.2w2';

    public static function login(Request $req): array
    {
        $in = $req->input();
        $email = $in->email('email');
        $password = $in->str('password', true);
        if (mb_strlen($password) > 128) {
            $in->error('password', 'Invalid email or password');
        }
        $in->validate();

        LoginThrottle::assertAllowed($email);

        $row = User::forLogin($email);
        // Verify against a dummy hash when the email is unknown, so the response time
        // does not reveal which emails have accounts.
        $hash = $row['password_hash'] ?? self::DUMMY_HASH;
        if (!password_verify($password, $hash) || !$row) {
            LoginThrottle::failed($email);
            Audit::login($row, $email, 'Login Failed');
            throw new HttpException(401, 'Invalid email or password');
        }
        LoginThrottle::succeeded($email);
        if (password_needs_rehash($row['password_hash'], PASSWORD_BCRYPT)) {
            User::setPassword((int) $row['id'], $password);
        }
        if ($row['status'] !== 'active') {
            Audit::login($row, $email, 'Login Blocked');
            throw new HttpException(403, 'This account is inactive. Contact your administrator.');
        }

        $token = Auth::issueToken((int) $row['id']);
        Audit::login($row, $email, 'Login');
        return ['token' => $token, 'user' => User::find((int) $row['id'])];
    }

    public static function logout(Request $req): array
    {
        Audit::log('Logout', 'Login', Auth::user()['name']);
        Auth::revoke($req);
        return ['ok' => true];
    }

    public static function me(Request $req): array
    {
        return User::find(Auth::id());
    }
}
