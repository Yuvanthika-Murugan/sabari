<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Input;
use App\Core\Request;
use App\Models\Agent;
use App\Models\Customer;
use App\Services\Audit;

/** Agents introduce customers and earn a commission on what those customers pay. */
final class AgentController
{
    public static function index(Request $req): array
    {
        return Agent::all();
    }

    public static function store(Request $req): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $data = self::validated($req->input());
        $data['agent_code'] = Agent::nextCode('agent_code', 'AGT', 3);
        $id = Agent::create($data);
        Audit::log('Agent Created', 'Agents', $data['agent_code'], '-', $data['name']);
        return Agent::find($id);
    }

    public static function update(Request $req, int $id): array
    {
        Auth::requireRole('md', 'admin', 'manager');
        $existing = Agent::find($id);
        $data = self::validated($req->input());
        Agent::update($id, $data);
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
        Agent::delete($id);
        Audit::log('Agent Deleted', 'Agents', $agent['agentCode'], $agent['name'], '-');
        return ['ok' => true];
    }

    private static function validated(Input $in): array
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
        $in->validate();
        return $data;
    }
}
