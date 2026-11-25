<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Input;
use App\Core\Request;
use App\Models\ApiToken;
use App\Models\User;
use App\Services\Audit;
use App\Services\PasswordPolicy;
use App\Services\Photos;
use App\Services\Visibility;

final class UserController
{
    public static function index(Request $req): array
    {
        return Visibility::users(User::all());
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin');
        $in = $req->input();
        $data = self::validated($in);
        $password = PasswordPolicy::check($in, 'password', $in->str('password', true), $data['email']);
        $in->validate();
        self::assertUnique($data);

        $data['emp_id'] = User::nextCode('emp_id', 'EMP', 3);
        $photo = self::uploadedPhoto($req);
        $data['photo_path'] = $photo;
        try {
            $id = User::create($data + ['password_hash' => User::hash($password)]);
        } catch (\Throwable $e) {
            Photos::delete($photo);
            throw $e;
        }
        Audit::log('User Created', 'Users', $data['emp_id'], '-', $data['name'] . ' (' . $data['role'] . ')');
        return User::find($id);
    }

    public static function update(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $existing = User::find($id);
        self::assertMayManage($existing);
        $in = $req->input();
        $data = self::validated($in);
        $in->validate();
        self::assertUnique($data, $id);
        if ($id === Auth::id() && $data['status'] !== 'active') {
            throw HttpException::unprocessable('You cannot deactivate your own account');
        }
        if ($id === Auth::id() && $data['role'] !== $existing['role']) {
            throw HttpException::unprocessable('You cannot change your own role', ['role' => 'Ask another MD or administrator to change it']);
        }

        // A new photo replaces the old one; removePhoto clears it. Otherwise it is left as is.
        $photo = self::uploadedPhoto($req);
        $replacesPhoto = $photo !== null || !empty($req->body['removePhoto']);
        if ($replacesPhoto) {
            $data['photo_path'] = $photo;
        }
        try {
            User::update($id, $data);
        } catch (\Throwable $e) {
            Photos::delete($photo);
            throw $e;
        }
        if ($replacesPhoto) {
            Photos::delete($existing['photo']);
            Audit::log($photo ? 'Profile Photo Updated' : 'Profile Photo Removed', 'Users', $existing['empId']);
        }
        Audit::log('User Updated', 'Users', $existing['empId'], $existing['status'], $data['status']);
        return User::find($id);
    }

    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        if ($id === Auth::id()) {
            throw HttpException::unprocessable('You cannot delete your own account');
        }
        $user = User::find($id);
        self::assertMayManage($user);
        User::delete($id);
        Photos::delete($user['photo']);
        Audit::log('User Deleted', 'Users', $user['empId'], $user['name'], '-');
        return ['ok' => true];
    }

    /** Sets a new password and signs the user out everywhere. */
    public static function resetPassword(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $user = User::find($id);
        self::assertMayManage($user);
        $in = $req->input();
        $password = PasswordPolicy::check($in, 'password', $in->str('password', true), $user['email']);
        $in->validate();

        User::setPassword($id, $password);
        ApiToken::revokeAllFor($id);
        Audit::log('Password Reset', 'Users', $user['empId']);
        return ['ok' => true];
    }

    /**
     * Only an MD may edit, reset the password of, or delete an MD account. Otherwise an
     * administrator could reset the MD's password and sign in as the MD.
     */
    private static function assertMayManage(array $target): void
    {
        if ($target['role'] === 'md' && !Auth::is('md')) {
            throw new HttpException(403, 'Only the MD can change an MD account');
        }
    }

    /** Stores the photo sent as a data URL in "photoData", if any, and returns its path. */
    private static function uploadedPhoto(Request $req): ?string
    {
        $dataUrl = $req->body['photoData'] ?? '';
        return is_string($dataUrl) && $dataUrl !== '' ? Photos::store($dataUrl, 'users') : null;
    }

    private static function validated(Input $in): array
    {
        $role = $in->enum('role', ['md', 'admin', 'manager', 'staff']);
        if ($role === 'md' && !Auth::is('md')) {
            $in->error('role', 'Only the MD can assign the MD role');
        }
        // emp_id is assigned by the server on create and never changes afterwards.
        return [
            'name' => $in->name('name', true),
            'phone' => $in->mobile('phone'),
            'email' => $in->email('email'),
            'role' => $role,
            'branch_id' => $in->id('branchId', true),
            'address' => $in->str('address'),
            'status' => $in->enum('status', ['active', 'inactive'], 'active'),
            'joining_date' => $in->date('joiningDate', true),
            'monthly_target' => $in->num('monthlyTarget'),
            'monthly_salary' => $in->num('monthlySalary'),
        ];
    }

    private static function assertUnique(array $data, int $ignoreId = 0): void
    {
        $errors = [];
        if (User::emailTaken($data['email'], $ignoreId)) {
            $errors['email'] = 'This email is already in use';
        }
        if ($errors) {
            throw HttpException::unprocessable('Please correct the highlighted fields', $errors);
        }
    }
}
