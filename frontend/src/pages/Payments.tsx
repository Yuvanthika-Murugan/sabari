import { useState } from 'react';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Modal, { ModalFooter } from '@/components/Modal';
import Badge from '@/components/Badge';
import { paymentModeOptions } from '@/lib/options';
import { Input, Select, TextArea } from '@/components/FormControls';
import { useData } from '@/context/DataContext';
import { useApp } from '@/context/AppContext';
import { useForm, useAction } from '@/hooks/useForm';
import { canActOnPayment, usePaymentActions, type PaymentAction } from '@/hooks/usePayments';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { PaymentApproval as Payment, Voucher } from '@/types';
import { CreditCard, ClipboardList, CheckCircle2, Check, X, Send, Eye } from 'lucide-react';

export function PaymentApproval() {
  const { paymentApprovals } = useData();
  const { currentUser } = useApp();
  const { act, busy } = usePaymentActions();
  const [showReview, setShowReview] = useState<string | null>(null);
  const reviewItem = paymentApprovals.find(p => p.id === showReview);
  const canAct = reviewItem ? canActOnPayment(currentUser?.role, reviewItem.currentStage) : false;

  const decide = async (action: PaymentAction) => {
    if (reviewItem && await act(reviewItem, action)) setShowReview(null);
  };

  const columns = [
    { key: 'paymentId', label: 'Payment ID', sortable: true, render: (p: Payment) => <span className="font-mono text-xs text-primary-600">{p.paymentId}</span> },
    { key: 'customerName', label: 'Customer', sortable: true, render: (p: Payment) => <span className="font-medium text-gray-900">{p.customerName}</span> },
    { key: 'amount', label: 'Amount', sortable: true, render: (p: Payment) => <span className="font-bold">{formatCurrency(p.amount)}</span> },
    { key: 'paymentMode', label: 'Mode', render: (p: Payment) => <Badge variant="gray">{p.paymentMode.replace('_', ' ').toUpperCase()}</Badge> },
    { key: 'referenceNo', label: 'Reference', render: (p: Payment) => <span className="font-mono text-xs text-gray-500">{p.referenceNo || '-'}</span> },
    { key: 'submittedBy', label: 'Submitted By' },
    { key: 'submittedTime', label: 'Submitted Time', sortable: true },
    { key: 'currentStage', label: 'Current Stage', render: (p: Payment) => <StatusBadge status={p.currentStage} /> },
    { key: 'actions', label: 'Action', render: (p: Payment) => (
      <button onClick={() => setShowReview(p.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors"><Eye className="w-4 h-4" /> Review</button>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Payment Approval" subtitle="Three-step payment workflow approval queue" actions={<ExportButtons filename="payment-approvals" rows={paymentApprovals} />} />

      {/* Workflow Visual */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Payment Workflow</h3>
        {/* Phones: 2×2 grid of steps; wider screens: one row joined by connector lines. */}
        <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:justify-between max-w-3xl">
          {[
            { label: 'Payment Informed', icon: CreditCard, color: 'bg-warning-100 text-warning-600' },
            { label: 'Manager Accepted', icon: CheckCircle2, color: 'bg-blue-100 text-blue-600' },
            { label: 'MD Approved', icon: CheckCircle2, color: 'bg-primary-100 text-primary-600' },
            { label: 'Completed', icon: CheckCircle2, color: 'bg-success-100 text-success-600' },
          ].map((step, i) => (
            <div key={i} className="flex items-center justify-center sm:justify-start">
              <div className="flex flex-col items-center gap-2">
                <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center`}><step.icon className="w-6 h-6" /></div>
                <span className="text-xs font-medium text-gray-700 text-center"><span className="sm:hidden">{i + 1}. </span>{step.label}</span>
              </div>
              {i < 3 && <div className="hidden sm:block w-8 md:w-16 h-0.5 bg-gray-200 mx-2" />}
            </div>
          ))}
        </div>
      </div>

      <DataTable columns={columns} data={paymentApprovals} searchKeys={['paymentId', 'customerName', 'referenceNo']} pageSize={10} />

      <Modal isOpen={!!reviewItem} onClose={() => setShowReview(null)} title="Review Payment" size="lg"
        footer={reviewItem ? (
          canAct ? (
            <div className="flex gap-2">
              <button onClick={() => decide('send_back')} disabled={busy} className="px-4 py-2 text-sm border border-gold-200 text-gold-700 rounded-lg hover:bg-gold-50 flex items-center gap-1 disabled:opacity-60"><Send className="w-4 h-4" /> Send Back</button>
              <button onClick={() => decide('reject')} disabled={busy} className="px-4 py-2 text-sm bg-danger-600 text-white rounded-lg hover:bg-danger-700 flex items-center gap-1 disabled:opacity-60"><X className="w-4 h-4" /> Reject</button>
              <button onClick={() => decide('approve')} disabled={busy} className="px-4 py-2 text-sm bg-success-600 text-white rounded-lg hover:bg-success-700 flex items-center gap-1 disabled:opacity-60"><Check className="w-4 h-4" /> {reviewItem.currentStage === 'payment_informed' ? 'Accept' : 'Approve'}</button>
            </div>
          ) : (
            <button onClick={() => setShowReview(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Close</button>
          )
        ) : null}
      >
        {reviewItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-500 text-xs">Payment ID</p><p className="font-mono font-medium">{reviewItem.paymentId}</p></div>
              <div><p className="text-gray-500 text-xs">{reviewItem.paymentType === 'customer' ? 'Customer' : 'Payment Type'}</p><p className="font-medium">{reviewItem.customerName}</p></div>
              <div><p className="text-gray-500 text-xs">Amount</p><p className="font-bold text-lg">{formatCurrency(reviewItem.amount)}</p></div>
              <div><p className="text-gray-500 text-xs">Payment Mode</p><p className="font-medium uppercase">{reviewItem.paymentMode.replace('_', ' ')}</p></div>
              <div><p className="text-gray-500 text-xs">Reference No</p><p className="font-mono">{reviewItem.referenceNo || '-'}</p></div>
              <div><p className="text-gray-500 text-xs">Branch</p><p className="font-medium">{reviewItem.branchName}</p></div>
              <div><p className="text-gray-500 text-xs">Submitted By</p><p className="font-medium">{reviewItem.submittedBy}</p></div>
              <div><p className="text-gray-500 text-xs">Submitted Time</p><p className="font-medium">{reviewItem.submittedTime}</p></div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Approval History</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-warning-100 flex items-center justify-center flex-shrink-0"><CreditCard className="w-4 h-4 text-warning-600" /></div>
                  <div><p className="text-sm font-medium text-gray-900">Payment Informed</p><p className="text-xs text-gray-500">By {reviewItem.submittedBy} at {reviewItem.submittedTime}</p></div>
                </div>
                {reviewItem.managerId && (
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${reviewItem.mdId || reviewItem.currentStage !== 'rejected' ? 'bg-blue-100' : 'bg-danger-100'} flex items-center justify-center flex-shrink-0`}>
                      {reviewItem.mdId || reviewItem.currentStage !== 'rejected' ? <CheckCircle2 className="w-4 h-4 text-blue-600" /> : <X className="w-4 h-4 text-danger-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{reviewItem.mdId || !['rejected', 'sent_back'].includes(reviewItem.currentStage) ? 'Manager Accepted' : `Manager ${reviewItem.currentStage === 'rejected' ? 'Rejected' : 'Sent Back'}`}</p>
                      <p className="text-xs text-gray-500">By {reviewItem.managerName} at {reviewItem.managerActionTime}</p>
                    </div>
                  </div>
                )}
                {reviewItem.mdId && (
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg ${reviewItem.currentStage === 'rejected' ? 'bg-danger-100' : 'bg-success-100'} flex items-center justify-center flex-shrink-0`}>
                      {reviewItem.currentStage === 'rejected' ? <X className="w-4 h-4 text-danger-600" /> : <CheckCircle2 className="w-4 h-4 text-success-600" />}
                    </div>
                    <div><p className="text-sm font-medium text-gray-900">{reviewItem.currentStage === 'rejected' ? 'MD Rejected' : reviewItem.currentStage === 'sent_back' ? 'MD Sent Back' : 'MD Approved'}</p><p className="text-xs text-gray-500">By {reviewItem.mdName} at {reviewItem.mdActionTime}</p></div>
                  </div>
                )}
              </div>
            </div>
            {reviewItem.remarks && <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">Remarks</p><p className="text-sm text-gray-700">{reviewItem.remarks}</p></div>}
            {!canAct && !['completed', 'rejected', 'sent_back'].includes(reviewItem.currentStage) && (
              <p className="text-xs text-gray-500">Waiting for {reviewItem.currentStage === 'payment_informed' ? 'a manager to accept' : 'MD approval'}.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/** What the selected customer owes, with one-click amounts. */
function CustomerDues({ customerId, onPick }: { customerId: string; onPick: (amount: number) => void }) {
  const { customers, groups, dueSchedules, collections, paymentApprovals, today } = useData();
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return null;

  const pending = dueSchedules.filter(d => d.customerId === customerId && d.pendingAmount > 0);
  const nextDue = pending[0];
  const arrears = pending.filter(d => d.dueDate < today).reduce((s, d) => s + d.pendingAmount, 0);
  const tillToday = pending.filter(d => d.dueDate <= today).reduce((s, d) => s + d.pendingAmount, 0);
  const inFlight = paymentApprovals
    .filter(p => p.customerId === customerId && ['payment_informed', 'manager_accepted', 'md_approved'].includes(p.currentStage))
    .reduce((s, p) => s + p.amount, 0);
  const payable = Math.max(0, customer.pending - inFlight);
  const lastReceipt = collections.find(c => c.customerId === customerId);
  const group = groups.find(g => g.id === customer.groupId);

  const quick = [
    { label: 'Next due', value: nextDue?.pendingAmount ?? 0 },
    { label: 'Due till today', value: tillToday },
    { label: 'Full balance', value: payable },
  ].filter((q, i, all) => q.value > 0 && q.value <= payable && all.findIndex(o => o.value === q.value) === i);

  return (
    <div className="col-span-full rounded-lg border border-primary-100 bg-primary-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-gray-900">{customer.name} <span className="text-gray-500 font-normal">· {group ? `${group.groupName} (${group.groupCode})` : 'No group'}</span></p>
        <p className="text-xs text-gray-500">{lastReceipt ? `Last paid ${formatCurrency(lastReceipt.collectedAmount)} on ${lastReceipt.date} (${lastReceipt.receiptNo})` : 'No payments yet'}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-500">Next Due</p><p className="text-sm font-bold text-primary-700">{nextDue ? formatCurrency(nextDue.pendingAmount) : '-'}</p><p className="text-xs text-gray-400">{nextDue ? `#${nextDue.dueNumber} · ${nextDue.dueDate}` : 'All paid'}</p></div>
        <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-500">Arrears</p><p className={`text-sm font-bold ${arrears > 0 ? 'text-danger-700' : 'text-gray-400'}`}>{formatCurrency(arrears)}</p><p className="text-xs text-gray-400">{pending.filter(d => d.dueDate < today).length} overdue dues</p></div>
        <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-500">Due Till Today</p><p className="text-sm font-bold text-warning-700">{formatCurrency(tillToday)}</p></div>
        <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-500">Total Balance</p><p className="text-sm font-bold text-gray-900">{formatCurrency(customer.pending)}</p><p className="text-xs text-gray-400">Paid {formatCurrency(customer.paid)} of {formatCurrency(customer.totalDue)}</p></div>
      </div>
      {inFlight > 0 && (
        <p className="text-xs text-warning-800 bg-warning-50 rounded-lg px-3 py-2">{formatCurrency(inFlight)} is already awaiting approval for this customer, so up to {formatCurrency(payable)} can be entered now.</p>
      )}
      {quick.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Fill amount:</span>
          {quick.map(q => (
            <button key={q.label} type="button" onClick={() => onPick(q.value)} className="px-3 py-1 text-xs bg-white border border-primary-200 text-primary-700 rounded-full hover:bg-primary-50">
              {q.label} · {formatCurrency(q.value)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const IN_FLIGHT = ['payment_informed', 'manager_accepted', 'md_approved'];
const roleLabel: Record<string, string> = { md: 'MD', admin: 'Admin', manager: 'Manager', staff: 'Staff' };

/** An employee's salary for a month: what's paid, what's awaiting approval, and what's left. */
function useSalaryStatus(employeeId: string, month: string) {
  const { users, paymentApprovals } = useData();
  const employee = users.find(u => u.id === employeeId);
  const forMonth = paymentApprovals.filter(p => p.paymentType === 'salary' && p.employeeId === employeeId && p.salaryMonth === month);
  const paid = forMonth.filter(p => p.currentStage === 'completed').reduce((s, p) => s + p.amount, 0);
  const awaiting = forMonth.filter(p => IN_FLIGHT.includes(p.currentStage)).reduce((s, p) => s + p.amount, 0);
  const salary = employee?.monthlySalary ?? 0;
  return { employee, salary, paid, awaiting, left: Math.max(0, salary - paid - awaiting), history: forMonth };
}

function EmployeeSalary({ employeeId, month, onPick }: { employeeId: string; month: string; onPick: (amount: number) => void }) {
  const { branches, paymentApprovals } = useData();
  const { employee, salary, paid, awaiting, left, history } = useSalaryStatus(employeeId, month);
  if (!employee) return null;
  const lastSalary = paymentApprovals.find(p => p.paymentType === 'salary' && p.employeeId === employeeId && p.currentStage === 'completed');

  return (
    <div className="col-span-full rounded-lg border border-primary-100 bg-primary-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-gray-900">{employee.name} <span className="text-gray-500 font-normal">· {employee.empId} · {roleLabel[employee.role]} · {branches.find(b => b.id === employee.branchId)?.name ?? '-'}</span></p>
        <p className="text-xs text-gray-500">{lastSalary ? `Last salary ${formatCurrency(lastSalary.amount)} for ${lastSalary.salaryMonth}` : 'No salary paid yet'}</p>
      </div>
      {salary <= 0 ? (
        <p className="text-sm text-warning-800 bg-warning-50 rounded-lg px-3 py-2">No monthly salary is set for {employee.name}. Set it under Company → Users before paying.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-500">Monthly Salary</p><p className="text-sm font-bold text-gray-900">{formatCurrency(salary)}</p></div>
            <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-500">Paid for {month}</p><p className="text-sm font-bold text-success-700">{formatCurrency(paid)}</p></div>
            <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-500">Awaiting Approval</p><p className={`text-sm font-bold ${awaiting ? 'text-warning-700' : 'text-gray-400'}`}>{formatCurrency(awaiting)}</p></div>
            <div className="bg-white rounded-lg p-3"><p className="text-xs text-gray-500">Balance to Pay</p><p className={`text-sm font-bold ${left ? 'text-primary-700' : 'text-gray-400'}`}>{formatCurrency(left)}</p></div>
          </div>
          {left > 0
            ? <button type="button" onClick={() => onPick(left)} className="px-3 py-1 text-xs bg-white border border-primary-200 text-primary-700 rounded-full hover:bg-primary-50">Fill amount · {formatCurrency(left)}</button>
            : <p className="text-xs text-success-700">The salary for {month} is fully paid or awaiting approval.</p>}
          {history.length > 0 && (
            <div className="text-xs text-gray-500 space-y-1">
              {history.map(p => <p key={p.id}><span className="font-mono">{p.paymentId}</span> · {formatCurrency(p.amount)} · {p.submittedTime} · <StatusBadge status={p.currentStage} /></p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function PaymentEntry() {
  const { paymentApprovals, customers, users, bankAccounts, today } = useData();
  const { currentUser } = useApp();
  const canPaySalary = currentUser?.role !== 'staff';
  const [showAdd, setShowAdd] = useState(false);
  const blank = {
    date: today, paymentType: 'customer', customerId: '', employeeId: '', salaryMonth: today.slice(0, 7),
    amount: '', paymentMode: 'cash', bankAccountId: '', referenceNo: '', description: '',
  };
  const form = useForm(blank);
  const fillAmount = (amount: number) => form.set('amount', amount > 0 ? String(Math.round(amount * 100) / 100) : '');

  // Picking an employee or month fills in that month's unpaid salary.
  const salaryLeftFor = (employeeId: string, month: string) => {
    const u = users.find(x => x.id === employeeId);
    const taken = paymentApprovals
      .filter(p => p.paymentType === 'salary' && p.employeeId === employeeId && p.salaryMonth === month && (p.currentStage === 'completed' || IN_FLIGHT.includes(p.currentStage)))
      .reduce((s, p) => s + p.amount, 0);
    return Math.max(0, (u?.monthlySalary ?? 0) - taken);
  };
  const pickEmployee = (id: string) => { form.set('employeeId', id); fillAmount(salaryLeftFor(id, form.values.salaryMonth)); };
  const pickMonth = (month: string) => { form.set('salaryMonth', month); if (form.values.employeeId) fillAmount(salaryLeftFor(form.values.employeeId, month)); };
  const employeeOptions = users
    .filter(u => u.status === 'active' || u.id === form.values.employeeId)
    .map(u => ({ value: u.id, label: `${u.name} (${u.empId}) · ${roleLabel[u.role]}${u.monthlySalary ? ` · ${formatCurrency(u.monthlySalary)}` : ''}` }));
  const nextCode = `PAY${String(paymentApprovals.reduce((m, p) => Math.max(m, Number(p.paymentId.slice(3)) || 0), 0) + 1).padStart(5, '0')}`;

  const save = async () => {
    if (await form.submit(v => api.post('/payments', v), 'Payment submitted for approval')) setShowAdd(false);
  };

  const columns = [
    { key: 'paymentId', label: 'Payment ID', sortable: true, render: (p: Payment) => <span className="font-mono text-xs text-primary-600">{p.paymentId}</span> },
    { key: 'customerName', label: 'Customer/Party', sortable: true, render: (p: Payment) => <span className="font-medium">{p.customerName}</span> },
    { key: 'amount', label: 'Amount', sortable: true, render: (p: Payment) => formatCurrency(p.amount) },
    { key: 'paymentMode', label: 'Mode', render: (p: Payment) => <Badge variant="gray">{p.paymentMode.replace('_', ' ').toUpperCase()}</Badge> },
    { key: 'referenceNo', label: 'Reference', render: (p: Payment) => <span className="font-mono text-xs text-gray-500">{p.referenceNo || '-'}</span> },
    { key: 'branchName', label: 'Branch' },
    { key: 'submittedBy', label: 'Entered By' },
    { key: 'currentStage', label: 'Status', render: (p: Payment) => <StatusBadge status={p.currentStage} /> },
  ];
  return (
    <div className="animate-fade-in">
      <PageHeader title="Payment Entry" subtitle="Record payments and transactions" actions={
        <button onClick={() => { form.reset(); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><CreditCard className="w-4 h-4" /> New Payment</button>
      } />
      <DataTable columns={columns} data={paymentApprovals} searchKeys={['paymentId', 'customerName', 'referenceNo']} pageSize={10} />
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Payment Entry" size="lg"
        footer={<ModalFooter onCancel={() => setShowAdd(false)} onSubmit={save} submitLabel="Save Payment" submitting={form.submitting} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><p className="text-xs font-medium text-gray-600 mb-1">Payment ID <span className="text-primary-600 font-mono">{nextCode} (auto)</span></p></div>
          <Input label="Payment Date" type="date" {...form.field('date')} required />
          <Select label="Payment Type" {...form.field('paymentType')} required
            options={[{ value: 'customer', label: 'Customer Payment' }, { value: 'expense', label: 'Expense' }, ...(canPaySalary ? [{ value: 'salary', label: 'Salary' }] : [])]} />
          {form.values.paymentType === 'customer' && (
            <Select label="Customer" {...form.field('customerId')} options={customers.filter(c => c.pending > 0).map(c => ({ value: c.id, label: `${c.name} (${c.customerId})` }))} required />
          )}
          {form.values.paymentType === 'salary' && (
            <Select label="Employee" {...form.field('employeeId')} onChange={pickEmployee} options={employeeOptions} required placeholder="Select employee..." />
          )}
          {form.values.paymentType === 'expense' && <div />}
          {form.values.paymentType === 'salary' && (
            <>
              <Input label="Salary Month" type="month" {...form.field('salaryMonth')} onChange={pickMonth} required />
              <div />
            </>
          )}
          {form.values.paymentType === 'customer' && form.values.customerId && (
            <CustomerDues customerId={form.values.customerId} onPick={fillAmount} />
          )}
          {form.values.paymentType === 'salary' && form.values.employeeId && (
            <EmployeeSalary employeeId={form.values.employeeId} month={form.values.salaryMonth} onPick={fillAmount} />
          )}
          <Input label="Amount" type="number" {...form.field('amount')} placeholder="10000" required />
          <Select label="Payment Mode" {...form.field('paymentMode')} options={paymentModeOptions} required />
          <Select label="Bank Account" {...form.field('bankAccountId')} options={bankAccounts.filter(a => a.status === 'active').map(a => ({ value: a.id, label: `${a.bankName} - ${a.accountNumber.slice(-4)}` }))} placeholder={form.values.paymentMode === 'cash' ? 'Not needed for cash' : 'Select...'} required={form.values.paymentMode !== 'cash'} />
          <Input label="Reference Number" format="reference" maxLength={60} {...form.field('referenceNo')} placeholder="REF12345678" />
          <TextArea label="Description" {...form.field('description')} placeholder="Payment description" className="col-span-full" />
          <p className="col-span-full text-xs text-gray-500">The payment goes to a manager for acceptance and then to the MD for approval. Approved customer payments are applied to the customer's dues.</p>
        </div>
      </Modal>
    </div>
  );
}

export function VoucherEntry() {
  const { vouchers, today } = useData();
  const { currentUser } = useApp();
  const canCreate = currentUser?.role !== 'staff';
  const canApprove = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const { run, busy } = useAction();
  const pending = vouchers.filter(v => v.approvalStatus === 'pending');
  const decide = (v: Voucher, decision: 'approved' | 'rejected') =>
    run(() => api.post(`/vouchers/${v.id}/decision`, { decision }), `Voucher ${v.voucherNumber} ${decision}`);
  const [showAdd, setShowAdd] = useState(false);
  const form = useForm({ date: today, voucherType: '', account: '', amount: '', paymentMode: 'cash', narration: '' });
  const nextCode = `VCH${String(vouchers.reduce((m, v) => Math.max(m, Number(v.voucherNumber.slice(3)) || 0), 0) + 1).padStart(6, '0')}`;

  const save = async () => {
    if (await form.submit(v => api.post('/vouchers', v), 'Voucher saved')) setShowAdd(false);
  };

  const columns = [
    { key: 'voucherNumber', label: 'Voucher No', sortable: true, render: (v: Voucher) => <span className="font-mono text-xs text-primary-600">{v.voucherNumber}</span> },
    { key: 'date', label: 'Date', sortable: true },
    { key: 'voucherType', label: 'Type', sortable: true, render: (v: Voucher) => <Badge variant={v.voucherType === 'receipt' ? 'success' : v.voucherType === 'payment' ? 'danger' : v.voucherType === 'expense' ? 'warning' : 'primary'}>{v.voucherType.toUpperCase()}</Badge> },
    { key: 'account', label: 'Account' },
    { key: 'amount', label: 'Amount', sortable: true, render: (v: Voucher) => formatCurrency(v.amount) },
    { key: 'paymentMode', label: 'Mode', render: (v: Voucher) => <Badge variant="gray">{v.paymentMode.replace('_', ' ').toUpperCase()}</Badge> },
    { key: 'narration', label: 'Narration', render: (v: Voucher) => <span className="text-gray-500 text-xs">{v.narration}</span> },
    { key: 'createdBy', label: 'Created By' },
    { key: 'approvalStatus', label: 'Status', render: (v: Voucher) => <StatusBadge status={v.approvalStatus} /> },
    ...(canApprove ? [{ key: 'actions', label: 'Actions', render: (v: Voucher) => v.approvalStatus === 'pending' ? (
      <div className="flex gap-1">
        <button onClick={() => decide(v, 'approved')} disabled={busy} className="p-1.5 rounded-lg hover:bg-success-50 text-success-600 disabled:opacity-40" title="Approve"><Check className="w-4 h-4" /></button>
        <button onClick={() => decide(v, 'rejected')} disabled={busy} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600 disabled:opacity-40" title="Reject"><X className="w-4 h-4" /></button>
      </div>
    ) : null }] : []),
  ];
  return (
    <div className="animate-fade-in">
      <PageHeader title="Voucher Entry" subtitle="Payment, Receipt, Expense & Contra vouchers" actions={
        <>
          <ExportButtons filename="vouchers" rows={vouchers} />
          {canCreate && <button onClick={() => { form.reset(); setShowAdd(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-md"><ClipboardList className="w-4 h-4" /> New Voucher</button>}
        </>
      } />
      {canApprove && pending.length > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-4 text-sm text-warning-800">
          {pending.length} voucher{pending.length > 1 ? 's' : ''} ({formatCurrency(pending.reduce((s, v) => s + v.amount, 0))}) waiting for approval. Approved cash vouchers post to today's cash book.
        </div>
      )}
      <DataTable columns={columns} data={vouchers} searchKeys={['voucherNumber', 'account']} pageSize={10} />
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Voucher Entry" size="lg"
        footer={<ModalFooter onCancel={() => setShowAdd(false)} onSubmit={save} submitLabel="Save Voucher" submitting={form.submitting} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><p className="text-xs font-medium text-gray-600 mb-1">Voucher Number <span className="text-primary-600 font-mono">{nextCode} (auto)</span></p></div>
          <Input label="Date" type="date" {...form.field('date')} required />
          <Select label="Voucher Type" {...form.field('voucherType')} options={[{ value: 'payment', label: 'Payment Voucher' }, { value: 'receipt', label: 'Receipt Voucher' }, { value: 'expense', label: 'Expense Voucher' }, { value: 'contra', label: 'Contra Voucher' }]} required />
          <Input label="Account" {...form.field('account')} placeholder="Account Head" required />
          <Input label="Amount" type="number" {...form.field('amount')} placeholder="10000" required />
          <Select label="Payment Mode" {...form.field('paymentMode')} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' }, { value: 'upi', label: 'UPI' }]} required />
          <TextArea label="Narration" {...form.field('narration')} placeholder="Voucher narration" className="col-span-full" />
          <p className="col-span-full text-xs text-gray-500">MD and Admin vouchers are approved on entry; manager vouchers wait for MD or Admin approval. Approved cash vouchers post to the cash book.</p>
        </div>
      </Modal>
    </div>
  );
}
