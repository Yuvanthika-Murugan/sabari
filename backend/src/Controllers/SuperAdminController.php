<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\Setting;
use App\Models\User;
use App\Services\Audit;
use App\Services\LoginThrottle;
use App\Services\PasswordPolicy;

/**
 * The Super Admin Panel is the Managing Director's panel (the main app is the Admin
 * panel). Everyone signs in on the same form: the MD with their email, or with the
 * optional Super Admin Login ID set inside the panel. Either opens a session as the MD.
 */
final class SuperAdminController
{
    private const LOGIN_KEY = 'super_admin_login';
    private const HASH_KEY = 'super_admin_password_hash';
    private const USER_KEY = 'super_admin_user_id';
    /** bcrypt hash of a random string nobody knows; only used to equalise timing. */
    private const DUMMY_HASH = '$2y$10$EGlii8zNbkWeUUiV64iiouYPKRXqKUUD66JdgbCFtP6G5zaRO.2w2';

    /** Kept for older clients; the sign-in page now uses POST /auth/login for everyone. */
    public static function login(Request $req): array
    {
        $in = $req->input();
        $loginId = mb_strtolower(trim($in->str('loginId', true, 60)));
        $password = $in->str('password', true);
        if (mb_strlen($password) > 128) {
            $in->error('password', 'Invalid Login ID or password');
        }
        $in->validate();
        return self::attempt($loginId, $password);
    }

    /** Whether $id is the Super Admin Login ID (so the shared sign-in form routes it here). */
    public static function isLoginId(string $id): bool
    {
        $stored = Setting::values();
        return ($stored[self::HASH_KEY] ?? '') !== '' && hash_equals((string) ($stored[self::LOGIN_KEY] ?? ''), $id);
    }

    /** Signs in with the Super Admin Login ID; returns token, user and superAdmin: true. */
    public static function attempt(string $loginId, string $password): array
    {
        // Throttled like the main sign-in, under its own key so it never locks a user's email.
        $throttleKey = 'superadmin:' . $loginId;
        LoginThrottle::assertAllowed($throttleKey);

        $stored = Setting::values();
        $hash = (string) ($stored[self::HASH_KEY] ?? '');
        $idMatches = $hash !== '' && hash_equals((string) ($stored[self::LOGIN_KEY] ?? ''), $loginId);
        $ok = password_verify($password, $idMatches ? $hash : self::DUMMY_HASH) && $idMatches;
        $userId = (int) ($stored[self::USER_KEY] ?? 0);
        if (!$ok) {
            LoginThrottle::failed($throttleKey);
            Audit::login(null, 'Super Admin: ' . $loginId, 'Super Admin Login Failed');
            throw new HttpException(401, 'Invalid Login ID or password');
        }
        LoginThrottle::succeeded($throttleKey);

        $user = DB::one('SELECT id, name, role, status FROM users WHERE id = ?', [$userId]);
        if (!$user || $user['role'] !== 'md' || $user['status'] !== 'active') {
            Audit::login($user, 'Super Admin: ' . $loginId, 'Super Admin Login Blocked');
            throw new HttpException(403, 'The Managing Director account linked to the Super Admin login is not active.');
        }

        $token = Auth::issueToken((int) $user['id']);
        Audit::login($user, 'Super Admin: ' . $loginId, 'Super Admin Login');
        return ['token' => $token, 'user' => User::find((int) $user['id']), 'superAdmin' => true];
    }

    /** MD only: the current Super Admin Login ID (never the password). */
    public static function show(Request $req): array
    {
        Auth::requireRole('md');
        $stored = Setting::values();
        return [
            'loginId' => (string) ($stored[self::LOGIN_KEY] ?? ''),
            'configured' => ($stored[self::HASH_KEY] ?? '') !== '',
        ];
    }

    /** MD only: set or change the Super Admin Login ID and password (needs the MD's own password). */
    public static function update(Request $req): array
    {
        Auth::requireRole('md');
        $in = $req->input();
        $loginId = mb_strtolower($in->pattern('loginId', '/^[A-Za-z0-9._@-]{4,60}$/', '4 to 60 letters, numbers or . _ @ -', true, 60, false));
        $new = $in->str('newPassword', true);
        $confirm = $in->str('confirmPassword', true);
        $current = $in->str('currentPassword', true);
        PasswordPolicy::check($in, 'newPassword', $new, (string) (User::find(Auth::id())['email'] ?? ''));
        if ($confirm !== '' && $confirm !== $new) {
            $in->error('confirmPassword', 'Does not match the new password');
        }
        $in->validate();

        if (!User::passwordMatches(Auth::id(), $current)) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['currentPassword' => 'Your current password is incorrect']);
        }
        if (password_verify($new, (string) DB::value('SELECT password_hash FROM users WHERE id = ?', [Auth::id()]))) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['newPassword' => 'Use a password different from your own sign-in password']);
        }

        $old = Setting::values()[self::LOGIN_KEY] ?? '';
        Setting::put(self::LOGIN_KEY, $loginId);
        Setting::put(self::HASH_KEY, User::hash($new));
        Setting::put(self::USER_KEY, (string) Auth::id());
        Audit::log('Super Admin Login Changed', 'Login', Auth::user()['name'], $old, $loginId);
        return ['loginId' => $loginId, 'configured' => true];
    }
}
