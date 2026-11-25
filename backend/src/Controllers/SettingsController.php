<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\ApiToken;
use App\Models\Branch;
use App\Models\Setting;
use App\Models\User;
use App\Services\Audit;
use App\Services\PasswordPolicy;
use App\Services\Photos;

/** Company settings, commission rules, and the signed-in user's own profile and password. */
final class SettingsController
{
    public static function index(Request $req): array
    {
        return Setting::company();
    }

    /**
     * Public (no sign-in): what the landing page shows visitors. Only the company's
     * name, address and GSTIN, and each active branch's name, address and phone.
     */
    public static function publicInfo(Request $req): array
    {
        $company = Setting::company();
        $branches = array_values(array_map(
            fn (array $b) => ['name' => $b['name'], 'address' => $b['address'], 'phone' => $b['phone']],
            array_filter(Branch::all(), fn (array $b) => $b['status'] === 'active'),
        ));
        return [
            'companyName' => $company['companyName'],
            'companyAddress' => $company['companyAddress'],
            'gstNumber' => $company['gstNumber'],
            'branches' => $branches,
        ];
    }

    public static function update(Request $req): array
    {
        Auth::requireRole('md', 'admin');
        $in = $req->input();
        $values = [
            'company_name' => $in->str('companyName', true, 160),
            'gst_number' => $in->pattern('gstNumber', '/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/', 'Must be a valid GSTIN (e.g. 33ABCDE1234F1Z5)', false, 20),
            'currency' => $in->enum('currency', ['inr'], 'inr'),
            'fy_start' => $in->enum('fyStart', ['apr', 'jan'], 'apr'),
            'company_address' => $in->str('companyAddress', false, 500),
            'upi_id' => strtolower($in->pattern('upiId', '/^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$/', 'Must be a valid UPI ID (e.g. sabarithendral@okaxis)', false, 100, false)),
            'upi_payee_name' => $in->str('upiPayeeName', false, 100),
        ];
        $in->validate();

        foreach ($values as $key => $value) {
            Setting::put($key, $value);
        }
        Audit::log('Settings Updated', 'Settings', 'company');
        return Setting::company();
    }

    public static function commission(Request $req): array
    {
        return Setting::commission();
    }

    public static function updateCommission(Request $req): array
    {
        Auth::requireRole('md', 'admin');
        $in = $req->input();
        $old = Setting::commission();
        $values = [];
        foreach (Setting::COMMISSION as $key => [$field]) {
            $values[$key] = $in->percent($field);
            if ($values[$key] !== null && $values[$key] > 100) {
                $in->error($field, 'Must be at most 100');
            }
        }
        if ($values['max_bid_pct'] < $values['foreman_commission_pct']) {
            $in->error('maxBidPct', 'Maximum bid cannot be lower than the foreman commission');
        }
        $in->validate();

        foreach ($values as $key => $value) {
            Setting::put($key, (string) $value);
        }
        $new = Setting::commission();
        $describe = fn (array $c) => sprintf('Foreman %s%%, Max bid %s%%, Agent %s%%', $c['foremanCommissionPct'], $c['maxBidPct'], $c['agentCommissionPct']);
        Audit::log('Commission Updated', 'Settings', 'commission', $describe($old), $describe($new));
        return $new;
    }

    /**
     * Any signed-in user may update their own name, email, phone and photo.
     * A new photo arrives as a data URL in "photoData"; "removePhoto" clears it.
     */
    public static function updateProfile(Request $req): array
    {
        $in = $req->input();
        $name = $in->name('name', true);
        $email = $in->email('email');
        $phone = $in->mobile('phone');
        $in->validate();
        if (User::emailTaken($email, Auth::id())) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['email' => 'This email is already in use']);
        }

        $existing = User::find(Auth::id());
        $dataUrl = $req->body['photoData'] ?? '';
        $photo = is_string($dataUrl) && $dataUrl !== '' ? Photos::store($dataUrl, 'users') : null;
        $replacesPhoto = $photo !== null || !empty($req->body['removePhoto']);

        $data = ['name' => $name, 'email' => $email, 'phone' => $phone];
        if ($replacesPhoto) {
            $data['photo_path'] = $photo;
        }
        try {
            User::update(Auth::id(), $data);
        } catch (\Throwable $e) {
            Photos::delete($photo);
            throw $e;
        }
        if ($replacesPhoto) {
            Photos::delete($existing['photo']);
            Audit::log($photo ? 'Profile Photo Updated' : 'Profile Photo Removed', 'Users', $existing['empId']);
        }
        return User::find(Auth::id());
    }

    /** Any signed-in user may change their own password; other sessions are signed out. */
    public static function changePassword(Request $req): array
    {
        $in = $req->input();
        $current = $in->str('currentPassword', true);
        $new = $in->str('newPassword', true);
        $confirm = $in->str('confirmPassword', true);
        PasswordPolicy::check($in, 'newPassword', $new, (string) (User::find(Auth::id())['email'] ?? ''));
        if ($new !== '' && $new === $current) {
            $in->error('newPassword', 'Choose a password different from the current one');
        }
        if ($confirm !== '' && $confirm !== $new) {
            $in->error('confirmPassword', 'Does not match the new password');
        }
        $in->validate();

        if (!User::passwordMatches(Auth::id(), $current)) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['currentPassword' => 'Current password is incorrect']);
        }

        User::setPassword(Auth::id(), $new);
        ApiToken::revokeAllFor(Auth::id(), (string) $req->bearerToken());
        Audit::log('Password Changed', 'Login', Auth::user()['name']);
        return ['ok' => true];
    }
}
