<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Input;
use App\Core\Request;
use App\Models\ChitGroup;
use App\Models\Collection;
use App\Models\Customer;
use App\Models\CustomerTransfer;
use App\Models\DueSchedule;
use App\Services\Audit;
use App\Services\Notifier;
use App\Services\Photos;

final class CustomerController
{
    public static function index(Request $req): array
    {
        return Customer::all();
    }

    public static function dues(Request $req, int $id): array
    {
        return DueSchedule::forCustomer($id);
    }

    /**
     * Saves where the customer is (their house / shop) from the phone's GPS, so the
     * route map can pin them. Office users, and the collection staff / agent of that
     * customer, may set it; "clear": true removes it.
     */
    public static function location(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager', 'staff');
        $customer = Customer::find($id);
        if (Auth::is('staff')) {
            $mine = (int) $customer['staffId'] === Auth::id()
                || ($customer['agentId'] !== '' && (int) DB::value('SELECT user_id FROM agents WHERE id = ?', [(int) $customer['agentId']]) === Auth::id());
            if (!$mine) {
                throw new HttpException(403, 'You can set the location only for your own customers');
            }
        }
        if (!empty($req->body['clear'])) {
            DB::exec('UPDATE customers SET latitude = NULL, longitude = NULL WHERE id = ?', [$id]);
            Audit::log('Customer Location Cleared', 'Customers', $customer['customerId']);
            return Customer::find($id);
        }
        $point = LocationController::point($req->body)
            ?? throw HttpException::unprocessable('Location not available. Turn on the phone\'s location and try again.');
        DB::exec('UPDATE customers SET latitude = ?, longitude = ? WHERE id = ?', [$point[0], $point[1], $id]);
        Audit::log('Customer Location Set', 'Customers', $customer['customerId'], '-', "{$point[0]},{$point[1]}");
        return Customer::find($id);
    }

    public static function transfers(Request $req): array
    {
        return CustomerTransfer::all();
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $in = $req->input();
        $data = self::validated($in);
        $data['group_id'] = $in->id('groupId', true);
        $in->validate();

        $group = ChitGroup::record($data['group_id'])
            ?? throw HttpException::unprocessable('Please correct the highlighted fields', ['groupId' => 'Group not found']);

        $photo = self::uploadedPhoto($req);
        $data['photo_path'] = $photo;
        try {
            return DB::transaction(function () use ($data, $group) {
                $data['customer_code'] = Customer::nextCode('customer_code', 'CUST', 5);
                $id = Customer::create($data);
                DueSchedule::createFor($id, $group, $data['joining_date']);
                Audit::log('Customer Created', 'Customers', $data['customer_code'], '-', $data['name']);
                return Customer::find($id);
            });
        } catch (\Throwable $e) {
            Photos::delete($photo);
            throw $e;
        }
    }

    public static function update(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $existing = Customer::find($id);
        $in = $req->input();
        $data = self::validated($in);
        $in->validate();
        // Group, staff and branch moves go through the transfer endpoint so they are recorded.
        unset($data['branch_id'], $data['staff_id']);

        // A new photo replaces the old one; removePhoto clears it. Otherwise it is left as is.
        $photo = self::uploadedPhoto($req);
        $replacesPhoto = $photo !== null || !empty($req->body['removePhoto']);
        if ($replacesPhoto) {
            $data['photo_path'] = $photo;
        }
        try {
            Customer::update($id, $data);
        } catch (\Throwable $e) {
            Photos::delete($photo);
            throw $e;
        }
        if ($replacesPhoto) {
            Photos::delete($existing['photo']);
            Audit::log($photo ? 'Customer Photo Updated' : 'Customer Photo Removed', 'Customers', $existing['customerId']);
        }
        Audit::log('Customer Updated', 'Customers', $existing['customerId'], $existing['status'], $data['status']);
        return Customer::find($id);
    }

    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $customer = Customer::find($id);
        if (Collection::existsFor($id)) {
            throw new HttpException(409, 'This customer has collection history and cannot be deleted. Set the status to Closed instead.');
        }
        Customer::delete($id);
        Photos::delete($customer['photo']);
        Audit::log('Customer Deleted', 'Customers', $customer['customerId'], $customer['name'], '-');
        return ['ok' => true];
    }

    /** Moves a customer to another group, staff member or branch, and records the move. */
    public static function transfer(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $c = Customer::recordOrFail($id);

        $in = $req->input();
        $toGroup = $in->id('toGroupId') ?? (int) $c['group_id'];
        $toStaff = $in->id('toStaffId') ?? (int) $c['staff_id'];
        $toBranch = $in->id('toBranchId') ?? (int) $c['branch_id'];
        $reason = $in->str('reason', true);
        $date = $in->date('transferDate', false, date('Y-m-d'));
        if ($date > date('Y-m-d')) {
            $in->error('transferDate', 'Transfer date cannot be in the future');
        }
        $in->validate();

        if ($toGroup === (int) $c['group_id'] && $toStaff === (int) $c['staff_id'] && $toBranch === (int) $c['branch_id']) {
            throw HttpException::unprocessable('Choose a different group, staff member or branch to transfer to');
        }
        if ($toGroup !== (int) $c['group_id']) {
            $group = ChitGroup::record($toGroup)
                ?? throw HttpException::unprocessable('Please correct the highlighted fields', ['toGroupId' => 'Group not found']);
            if (Customer::countInGroup($toGroup) >= (int) $group['number_of_members']) {
                throw HttpException::unprocessable('Please correct the highlighted fields', ['toGroupId' => 'This group has no vacant places']);
            }
        }

        return DB::transaction(function () use ($c, $id, $toGroup, $toStaff, $toBranch, $reason, $date) {
            CustomerTransfer::create([
                'customer_id' => $id,
                'from_group_id' => $c['group_id'], 'to_group_id' => $toGroup,
                'from_staff_id' => $c['staff_id'], 'to_staff_id' => $toStaff,
                'from_branch_id' => $c['branch_id'], 'to_branch_id' => $toBranch,
                'transfer_date' => $date,
                'reason' => $reason,
                'created_by' => Auth::id(),
            ]);
            Customer::moveTo($id, $toGroup, $toStaff, $toBranch);
            DueSchedule::moveUnpaidToGroup($id, $toGroup);

            $codes = ChitGroup::codes([(int) $c['group_id'], $toGroup]);
            $code = fn ($gid) => $codes[$gid] ?? '-';
            Notifier::push('transfer', 'Customer Transfer', sprintf('%s transferred from %s to %s', $c['name'], $code($c['group_id']), $code($toGroup)));
            Audit::log('Customer Transferred', 'Customer Transfer', $c['customer_code'], $code($c['group_id']), $code($toGroup));
            return Customer::find($id);
        });
    }

    /** Stores the photo sent as a data URL in "photoData", if any, and returns its path. */
    private static function uploadedPhoto(Request $req): ?string
    {
        $dataUrl = $req->body['photoData'] ?? '';
        return is_string($dataUrl) && $dataUrl !== '' ? Photos::store($dataUrl) : null;
    }

    private static function validated(Input $in): array
    {
        return [
            'name' => $in->name('name', true),
            'father_spouse_name' => $in->name('fatherSpouseName'),
            'mobile' => $in->mobile('mobile'),
            'alt_mobile' => $in->mobile('altMobile', false),
            'branch_id' => $in->id('branchId', true),
            'staff_id' => $in->id('staffId'),
            'agent_id' => $in->id('agentId'),
            'area' => $in->str('area', false, 120),
            'joining_date' => $in->date('joiningDate', true),
            'status' => $in->enum('status', ['active', 'inactive', 'closed'], 'active'),
            'address' => $in->str('address'),
        ] + self::details($in);
    }

    /**
     * Optional subscriber details from the subscriber entry form. Only fields
     * present in the request are returned, so forms that don't send them
     * (e.g. the customer list's edit form) leave the stored values alone.
     */
    private static function details(Input $in): array
    {
        $fields = [
            'repName' => fn () => ['rep_name', $in->name('repName')],
            'panNo' => function () use ($in) {
                $pan = strtoupper($in->str('panNo', false, 10));
                if ($pan !== '' && !preg_match('/^[A-Z]{5}[0-9]{4}[A-Z]$/', $pan)) {
                    $in->error('panNo', 'Must be a valid PAN (e.g. ABCDE1234F)');
                }
                return ['pan_no', $pan];
            },
            'dob' => function () use ($in) {
                $dob = $in->date('dob');
                if ($dob !== null && $dob > date('Y-m-d')) {
                    $in->error('dob', 'Date of birth cannot be in the future');
                }
                return ['dob', $dob];
            },
            'phone' => fn () => ['phone', $in->phone('phone')],
            'email' => fn () => ['email', $in->email('email', false)],
            'district' => fn () => ['district', $in->name('district', false, 80)],
            'pincode' => fn () => ['pincode', $in->pincode('pincode')],
            'permanentAddress' => fn () => ['permanent_address', self::flag($in, 'permanentAddress')],
            'agentType' => fn () => ['agent_type', $in->enum('agentType', ['single', 'multi'], 'single')],
            'nomineeName' => fn () => ['nominee_name', $in->name('nomineeName')],
            'nomineeRelation' => fn () => ['nominee_relation', $in->name('nomineeRelation', false, 60)],
            'nomineeMobile' => fn () => ['nominee_mobile', $in->mobile('nomineeMobile', false)],
            'nomineeAge' => function () use ($in) {
                $age = $in->has('nomineeAge') && trim((string) $in->str('nomineeAge')) !== '' ? $in->int('nomineeAge', false, 0, 120) : null;
                return ['nominee_age', $age];
            },
            'intimationType' => fn () => ['intimation_type', $in->enum('intimationType', ['post', 'hand', 'courier'], 'post')],
            'intimationCard' => fn () => ['intimation_card', self::flag($in, 'intimationCard')],
            'collectionType' => fn () => ['collection_type', $in->enum('collectionType', ['monthly', 'bimonthly', 'weekly', 'daily'], 'monthly')],
            // Map location of the customer's house / shop ('' clears it).
            'latitude' => fn () => ['latitude', self::coord($in, 'latitude', 90)],
            'longitude' => fn () => ['longitude', self::coord($in, 'longitude', 180)],
        ];
        $data = [];
        foreach ($fields as $key => $read) {
            if ($in->has($key)) {
                [$column, $value] = $read();
                $data[$column] = $value;
            }
        }
        return $data;
    }

    /** A latitude / longitude within ±$limit (null when empty). */
    private static function coord(Input $in, string $key, int $limit): ?float
    {
        $value = $in->str($key, false, 20);
        if ($value === '') {
            return null;
        }
        if (!is_numeric($value) || abs((float) $value) > $limit) {
            $in->error($key, 'Must be a number between -' . $limit . ' and ' . $limit);
            return null;
        }
        return round((float) $value, 7);
    }

    /** A yes/no field sent as "1"/"0", "true"/"false" or a boolean. */
    private static function flag(Input $in, string $key): int
    {
        $value = $in->str($key);
        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
    }
}
