<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Request;
use App\Models\Customer;
use App\Models\DueSchedule;
use App\Models\Payment;
use App\Models\User;
use App\Services\Audit;
use App\Services\Ledger;
use App\Services\Notifier;
use App\Services\Visibility;

/**
 * Payment approval workflow:
 *   payment_informed --(manager accepts)--> manager_accepted --(MD approves)--> completed
 * Either step can reject or send the payment back to the submitter.
 */
final class PaymentController
{
    public static function index(Request $req): array
    {
        return Visibility::payments(Payment::all());
    }

    public static function store(Request $req): array
    {
        $in = $req->input();
        $type = $in->enum('paymentType', ['customer', 'expense', 'salary']);
        $customerId = $in->id('customerId', $type === 'customer');
        $amount = $in->num('amount', true, 1);
        $mode = $in->enum('paymentMode', CollectionController::MODES);
        $bankId = $in->id('bankAccountId');
        $reference = $in->reference('referenceNo');
        $date = $in->date('date', false, date('Y-m-d'));
        $remarks = $in->str('description');
        if ($mode !== null && $mode !== 'cash' && $bankId === null) {
            $in->error('bankAccountId', 'Choose the bank account for non-cash payments');
        }
        if ($type === 'customer' && $customerId !== null) {
            // Catch an over-payment now rather than at the MD's final approval.
            $inFlight = Payment::inFlightFor($customerId);
            $payable = max(0, DueSchedule::balance($customerId) - $inFlight);
            if ($payable <= 0) {
                $in->error('customerId', $inFlight > 0 ? 'This customer\'s balance is already covered by payments awaiting approval' : 'This customer has no balance to pay');
            } elseif ($amount > $payable + 0.001) {
                $in->error('amount', 'Cannot exceed ' . Audit::money($payable) . ($inFlight > 0 ? ' (balance less payments awaiting approval)' : ' (the customer\'s balance)'));
            }
        }
        $employee = null;
        $month = null;
        if ($type === 'salary') {
            if (!Auth::is('md', 'admin', 'manager')) {
                throw HttpException::forbidden();
            }
            $employeeId = $in->id('employeeId', true);
            $month = $in->str('salaryMonth', true, 7);
            if ($month !== '' && !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
                $in->error('salaryMonth', 'Choose a month');
            }
            $employee = $employeeId ? User::record($employeeId) : null;
            if ($employeeId && !$employee) {
                $in->error('employeeId', 'Employee not found');
            } elseif ($employee && (float) $employee['monthly_salary'] <= 0) {
                $in->error('employeeId', 'Set this employee\'s monthly salary in Users first');
            } elseif ($employee && $month !== '') {
                // Salary already paid or awaiting approval for that month.
                $left = max(0, (float) $employee['monthly_salary'] - Payment::salaryTaken($employeeId, $month));
                if ($left <= 0) {
                    $in->error('salaryMonth', "{$employee['name']}'s salary for $month is already paid or awaiting approval");
                } elseif ($amount > $left + 0.001) {
                    $in->error('amount', 'Cannot exceed ' . Audit::money($left) . ' (salary balance for ' . $month . ')');
                }
            }
        }
        $in->validate();

        $branchId = match (true) {
            $customerId !== null && $type === 'customer' => Customer::record($customerId)['branch_id'] ?? null,
            $employee !== null => $employee['branch_id'],
            default => Auth::user()['branch_id'],
        };

        $code = DB::transaction(function () use ($type, $customerId, $employee, $month, $amount, $mode, $bankId, $reference, $date, $remarks, $branchId) {
            $code = Payment::nextCode('payment_code', 'PAY', 5);
            Payment::create([
                'payment_code' => $code,
                'payment_type' => $type,
                'customer_id' => $type === 'customer' ? $customerId : null,
                'employee_id' => $employee['id'] ?? null,
                'salary_month' => $month,
                'amount' => $amount,
                'payment_mode' => $mode,
                'bank_account_id' => $bankId,
                'reference_no' => $reference,
                'remarks' => $remarks,
                'submitted_by' => Auth::id(),
                'branch_id' => $branchId,
                'submitted_at' => $date . ' ' . date('H:i:s'),
            ]);
            Notifier::push('payment_submitted', 'Payment Submitted', sprintf('%s submitted %s (%s)', Auth::user()['name'], Audit::money($amount), $code));
            Audit::log('Payment Submitted', 'Payments', $code, '-', Audit::money($amount));
            return $code;
        });
        return ['paymentId' => $code];
    }

    public static function action(Request $req, int $id): array
    {
        $in = $req->input();
        $action = $in->enum('action', ['approve', 'reject', 'send_back']);
        $in->validate();

        $p = Payment::recordOrFail($id);
        $stage = $p['current_stage'];
        $now = date('Y-m-d H:i:s');

        // Who may act at each stage.
        $atManagerStep = $stage === 'payment_informed';
        $atMdStep = in_array($stage, ['manager_accepted', 'md_approved'], true);
        if ($atManagerStep) {
            Auth::requireRole('manager', 'admin', 'md');
        } elseif ($atMdStep) {
            Auth::requireRole('md');
        } else {
            throw HttpException::unprocessable('This payment is already ' . str_replace('_', ' ', $stage));
        }

        DB::transaction(function () use ($p, $id, $action, $atManagerStep, $now, $stage) {
            $actor = $atManagerStep ? ['manager_id' => Auth::id(), 'manager_action_at' => $now] : ['md_id' => Auth::id(), 'md_action_at' => $now];
            $newStage = match ($action) {
                'approve' => $atManagerStep ? 'manager_accepted' : 'completed',
                'reject' => 'rejected',
                'send_back' => 'sent_back',
            };
            Payment::update($id, ['current_stage' => $newStage] + $actor);

            $amount = Audit::money((float) $p['amount']);
            if ($newStage === 'manager_accepted') {
                Notifier::push('md_approval', 'MD Approval Required', "{$p['payment_code']} ($amount) accepted by manager");
            } elseif ($newStage === 'completed') {
                self::post($p);
                Notifier::push('payment_approved', 'Payment Approved', "{$p['payment_code']} ($amount) approved");
            } elseif ($newStage === 'rejected') {
                Notifier::push('payment_rejected', 'Payment Rejected', "{$p['payment_code']} ($amount) rejected");
            }
            $label = ['manager_accepted' => 'Payment Accepted', 'completed' => 'Payment Approved', 'rejected' => 'Payment Rejected', 'sent_back' => 'Payment Sent Back'][$newStage];
            Audit::log($label, 'Payments', $p['payment_code'], $stage, $newStage);
        });

        return ['ok' => true];
    }

    /** Posts an approved payment to the books. */
    private static function post(array $p): void
    {
        $amount = (float) $p['amount'];
        $date = date('Y-m-d');
        if ($p['payment_type'] === 'customer') {
            Ledger::collect((int) $p['customer_id'], null, $amount, $p['payment_mode'], $p['reference_no'] ?: $p['payment_code'], $date, date('H:i:s'), "Approved payment {$p['payment_code']}");
            if ($p['bank_account_id']) {
                Ledger::bank((int) $p['bank_account_id'], $date, "Customer payment {$p['payment_code']}", $amount, 0, 'collection');
            }
            return;
        }
        $description = ucfirst($p['payment_type']) . " payment {$p['payment_code']}";
        if ($p['employee_id']) {
            $description = "Salary {$p['salary_month']} - " . User::name((int) $p['employee_id']) . " ({$p['payment_code']})";
        }
        if ($p['payment_mode'] === 'cash') {
            Ledger::cash($date, $p['payment_code'], $description, $amount, 0, $p['payment_type'] === 'expense' ? 'expense' : 'payment');
        } elseif ($p['bank_account_id']) {
            Ledger::bank((int) $p['bank_account_id'], $date, $description, 0, $amount, 'transfer');
        }
    }
}
