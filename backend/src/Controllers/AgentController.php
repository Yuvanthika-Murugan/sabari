<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Input;
use App\Core\Request;
use App\Models\Agent;
use App\Models\ApiToken;
use App\Models\Customer;
use App\Models\User;
use App\Services\Audit;
use App\Services\PasswordPolicy;

/**
 * Agents introduce customers and earn a commission on what those customers pay.
 * An agent given an email and password also gets a login account (role "staff",
 * the collection app), linked by agents.user_id and kept in step with the agent.
 */
final class AgentController
{
    public static function index(Request $req): array
    {
        return Agent::all();
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $in = $req->input();
        $data = self::validated($in, false);
        // Login is optional here (the Agents page may add agents without one), but an
        // email needs a password and a password needs an email.
        $email = trim((string) ($req->body['email'] ?? '')) !== '' ? $in->email('email') : '';
        $password = $in->str('password', $email !== '');
        if ($password !== '' && $email === '') {
            $in->error('email', 'Enter an email so the agent can sign in');
        }
        PasswordPolicy::check($in, 'password', $password, $email);
        $in->validate();
        if ($email !== '' && User::emailTaken($email)) {
            throw HttpException::unprocessable('Please correct the highlighted fields', ['email' => 'This email is already in use']);
        }

        $id = DB::transaction(function () use ($data, $email, $password) {
            $data['agent_code'] = Agent::nextCode('agent_code', 'AGT', 3);
            if ($email !== '') {
                $empId = User::nextCode('emp_id', 'EMP', 3);
                $data['user_id'] = User::create([
                    'emp_id' => $empId, 'name' => $data['name'], 'phone' => $data['mobile'], 'email' => $email,
                    'password_hash' => User::hash($password), 'role' => 'staff', 'branch_id' => $data['branch_id'],
                    'address' => $data['address'], 'status' => $data['status'], 'joining_date' => $data['joining_date'],
                ]);
                Audit::log('User Created', 'Users', $empId, '-', $data['name'] . ' (agent login)');
            }
            $agentId = Agent::create($data);
            Audit::log('Agent Created', 'Agents', $data['agent_code'], '-', $data['name']);
            return $agentId;
        });
        return Agent::find($id);
    }

    public static function update(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $existing = Agent::find($id);
        $data = self::validated($req->input());
        DB::transaction(function () use ($id, $existing, $data) {
            Agent::update($id, $data);
            // Keep the agent's login account in step: name, mobile, branch and status.
            if ($existing['userId'] !== '') {
                $userId = (int) $existing['userId'];
                User::update($userId, ['name' => $data['name'], 'phone' => $data['mobile'], 'branch_id' => $data['branch_id'], 'status' => $data['status']]);
                if ($data['status'] !== 'active') {
                    ApiToken::revokeAllFor($userId);
                }
            }
        });
        Audit::log('Agent Updated', 'Agents', $existing['agentCode'],
            "{$existing['name']} ({$existing['commissionPct']}%)", "{$data['name']} ({$data['commission_pct']}%)");
        return Agent::find($id);
    }

    public static function destroy(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin');
        $agent = Agent::find($id);
        if (Customer::hasAgent($id)) {
            throw new HttpException(409, 'This agent has customers. Set the agent to Inactive instead.');
        }
        DB::transaction(function () use ($id, $agent) {
            Agent::delete($id);
            // The login account may have receipts against it, so it is deactivated, not deleted.
            if ($agent['userId'] !== '') {
                User::update((int) $agent['userId'], ['status' => 'inactive']);
                ApiToken::revokeAllFor((int) $agent['userId']);
            }
        });
        Audit::log('Agent Deleted', 'Agents', $agent['agentCode'], $agent['name'], '-');
        return ['ok' => true];
    }

    private static function validated(Input $in, bool $check = true): array
    {
        $data = [
            'name' => $in->name('name', true),
            'mobile' => $in->mobile('mobile'),
            'branch_id' => $in->id('branchId', true),
            'commission_pct' => $in->percent('commissionPct'),
            'joining_date' => $in->date('joiningDate'),
            'status' => $in->enum('status', ['active', 'inactive'], 'active'),
            'address' => $in->str('address'),
        ];
        if ($data['commission_pct'] > 100) {
            $in->error('commissionPct', 'Must be at most 100');
        }
        if ($check) {
            $in->validate();
        }
        return $data;
    }
}
