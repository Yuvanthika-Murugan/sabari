import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader, StatusBadge, ExportButtons } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import KPICard from '@/components/KPICard';
import { CustomerAvatar } from '@/components/PhotoInput';
import { Select, FilterBar, Dropdown, DateRangeFilter } from '@/components/FormControls';
import { inDateRange } from '@/lib/format';
import { useData } from '@/context/DataContext';
import { formatCurrency, daysBetween } from '@/lib/format';
import type { Collection, DueSchedule } from '@/types';
import { AlertCircle, Users, Clock, HandCoins, Wallet, Receipt, Trophy, Search, UserPlus, Eye, UserRound, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import Modal from '@/components/Modal';
import SubscriberForm from '@/components/SubscriberForm';
import ArTransferForm from '@/components/ArTransferForm';
import { useApp } from '@/context/AppContext';

/**
 * AR Subscribers: every subscriber with all the details entered in the
 * Add Subscriber form, plus their arrears (installments past due and unpaid).
 */
export function ArrearSubscribers() {
  const { customers, dueSchedules, branches, groups, users, areas, agents, today } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  // The dashboard's boxes open this page with a "show" filter preselected.
  type Show = 'all' | 'arrears' | 'completed';
  const asShow = (x: unknown): Show => (x === 'arrears' || x === 'completed' ? x : 'all');
  const [showFilter, setShowFilter] = useState<Show>(asShow((location.state as { show?: string } | null)?.show));
  const [branchFilter, setBranchFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  // Transfer to chit group: null = closed, '' = opened from the header, else the customer it was opened for.
  const [transferFor, setTransferFor] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const { currentUser } = useApp();
  const canAdd = currentUser?.role !== 'staff';

  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? '';
  const groupName = (id: string) => groups.find(g => g.id === id)?.groupName ?? '';
  const staffName = (id: string) => users.find(u => u.id === id)?.name ?? '';
  const agentName = (id: string) => agents.find(a => a.id === id)?.name ?? '';

  const all = customers.map(c => {
    const overdue = dueSchedules.filter(d => d.customerId === c.id && d.pendingAmount > 0 && d.dueDate < today);
    const oldestDue = overdue[0]?.dueDate ?? '';
    return {
      ...c,
      dues: overdue.length,
      arrears: overdue.reduce((s, d) => s + d.pendingAmount, 0),
      oldestDue,
      daysOverdue: oldestDue ? daysBetween(oldestDue, today) : 0,
    };
  });
  const rows = all.filter(r =>
    (showFilter === 'all' || (showFilter === 'arrears' ? r.arrears > 0 : r.totalDue > 0 && r.pending <= 0)) &&
    (!branchFilter || r.branchId === branchFilter) &&
    (!groupFilter || r.groupId === groupFilter) &&
    (!staffFilter || r.staffId === staffFilter) &&
    (!areaFilter || r.area === areaFilter) &&
    inDateRange(r.joiningDate, fromDate, toDate) &&
    (!ageFilter || (r.arrears > 0 && (ageFilter === '30' ? r.daysOverdue <= 30 : ageFilter === '90' ? r.daysOverdue > 30 && r.daysOverdue <= 90 : r.daysOverdue > 90)))
  );
  const inArrears = rows.filter(r => r.arrears > 0);
  const totalArrears = inArrears.reduce((s, r) => s + r.arrears, 0);
  // Boxes follow the filters: new = enrolled this calendar month; completed = every due paid.
  const newThisMonth = rows.filter(r => r.joiningDate.slice(0, 7) === today.slice(0, 7));
  const completed = rows.filter(r => r.totalDue > 0 && r.pending <= 0);

  type Row = (typeof rows)[number];
  const two = (main: string, sub?: string) => (
    <div><p className="text-gray-900">{main}</p>{sub && <p className="text-xs text-gray-500">{sub}</p>}</div>
  );
  const columns = [
    // Related details share a cell (main value + a small grey second line) so the
    // table fits the screen without sideways scrolling; everything else is in View.
    { key: 'name', label: 'Subscriber', sortable: true, render: (r: Row) => (
      <div className="flex items-center gap-2.5">
        <CustomerAvatar name={r.name} photo={r.photo} />
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{r.name}</p>
          <p className="text-xs text-gray-500"><span className="font-mono text-primary-600">{r.customerId}</span>{r.fatherSpouseName && ` · S/O ${r.fatherSpouseName}`}</p>
        </div>
      </div>
    )},
    { key: 'mobile', label: 'Mobile', render: (r: Row) => two(r.mobile, r.phone) },
    { key: 'groupId', label: 'Group', render: (r: Row) => two(groupName(r.groupId) || '-', `Since ${r.joiningDate}`) },
    { key: 'area', label: 'Area / Branch', sortable: true, render: (r: Row) => two(r.area || '-', branchName(r.branchId)) },
    { key: 'staffId', label: 'Staff / Agent', render: (r: Row) => two(staffName(r.staffId) || '-', `Agent: ${agentName(r.agentId) || 'Direct'}`) },
    { key: 'arrears', label: 'Arrears', sortable: true, render: (r: Row) => (
      <div>
        {r.arrears > 0
          ? <><p className="font-bold text-danger-600">{formatCurrency(r.arrears)}</p>
              <Badge variant={r.daysOverdue > 90 ? 'danger' : r.daysOverdue > 30 ? 'warning' : 'gold'}>{r.dues} due · {r.daysOverdue} days</Badge></>
          : <Badge variant="success">No arrears</Badge>}
        <p className="text-xs text-gray-500 mt-1">Paid <span className="text-success-600 font-medium">{formatCurrency(r.paid)}</span></p>
      </div>
    )},
    { key: 'status', label: 'Status', render: (r: Row) => <StatusBadge status={r.status} /> },
    { key: 'actions', label: 'Actions', render: (r: Row) => (
      <Dropdown label="Actions" items={[
        { label: 'View details', onClick: () => setViewId(r.id), icon: <Eye className="w-3.5 h-3.5" /> },
        { label: 'Profile', onClick: () => navigate('/enquiry/profile', { state: { customerId: r.id } }), icon: <UserRound className="w-3.5 h-3.5" /> },
        ...(r.arrears > 0 ? [{ label: 'Collect arrears', onClick: () => navigate('/receipts/entry'), icon: <HandCoins className="w-3.5 h-3.5" /> }] : []),
        ...(canAdd && r.status !== 'closed' ? [{ label: 'Transfer to chit group', onClick: () => setTransferFor(r.id), icon: <ArrowRightLeft className="w-3.5 h-3.5" /> }] : []),
      ]} />
    )},
  ];

  // Excel export: every field from the form, with names instead of ids.
  const exportRows = rows.map(r => ({
    'Customer ID': r.customerId, Name: r.name, 'S/O or W/O': r.fatherSpouseName, 'Rep Name': r.repName,
    Branch: branchName(r.branchId), Group: groupName(r.groupId), 'Enrolment Date': r.joiningDate,
    'PAN No': r.panNo, 'Date of Birth': r.dob, Mobile: r.mobile, 'Alt Mobile': r.altMobile, Phone: r.phone, Email: r.email,
    Address: r.address, District: r.district, PIN: r.pincode, 'Permanent Address': r.permanentAddress ? 'Yes' : 'No',
    Area: r.area, 'Collection Staff': staffName(r.staffId), 'Agent Type': r.agentType, Agent: agentName(r.agentId) || 'Direct',
    'Nominee Name': r.nomineeName, 'Nominee Relation': r.nomineeRelation, 'Nominee Mobile': r.nomineeMobile,'Nominee Age': r.nomineeAge,
    Intimation: r.intimationType, 'Intimation Card': r.intimationCard ? 'Yes' : 'No', Collection: r.collectionType,
    'Total Due': r.totalDue, Paid: r.paid, Balance: r.pending, 'Overdue Dues': r.dues, Arrears: r.arrears,
    'Oldest Due': r.oldestDue, 'Days Overdue': r.daysOverdue, Status: r.status,
  }));

  const view = all.find(r => r.id === viewId);
  const viewGroup = view && groups.find(g => g.id === view.groupId);
  const field = (label: string, value: string | number | undefined) => (
    <div><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900 break-words">{value === undefined || value === '' ? '-' : value}</p></div>
  );
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  return (
    <div className="animate-fade-in">
      <PageHeader title="AR Subscribers" subtitle="All subscribers with their details and arrears (installments past their due date)" actions={
        <>
          <ExportButtons filename="ar-subscribers" rows={exportRows} />
          {canAdd && <button onClick={() => setTransferFor('')} className="flex items-center gap-2 px-4 py-2 border border-primary-200 text-primary-700 bg-white text-sm font-medium rounded-lg hover:bg-primary-50 transition-colors"><ArrowRightLeft className="w-4 h-4" /> Transfer to Chit Group</button>}
          {canAdd && <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-md"><UserPlus className="w-4 h-4" /> Add Subscriber</button>}
        </>
      } />
      <SubscriberForm isOpen={showAdd} onClose={() => setShowAdd(false)} />
      {/* Mounted only while open, so each opening starts from a clean form. */}
      {transferFor !== null && <ArTransferForm isOpen customerId={transferFor} onClose={() => setTransferFor(null)} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="New Subscribers" value={String(newThisMonth.length)} icon={<UserPlus className="w-6 h-6" />} color="gold" trend="neutral" trendValue="Joined this month" />
        <KPICard title="Total Subscribers" value={String(rows.length)} icon={<Users className="w-6 h-6" />} color="primary" />
        <KPICard title="Completed" value={String(completed.length)} icon={<CheckCircle2 className="w-6 h-6" />} color="success" trend="neutral" trendValue="All dues paid" />
        <KPICard title="Overdue Customers" value={String(inArrears.length)} icon={<AlertCircle className="w-6 h-6" />} color="danger" trend="neutral" trendValue={`${formatCurrency(totalArrears)} overdue`} />
      </div>
      <FilterBar>
        <Select label="Show" value={showFilter} onChange={v => setShowFilter(asShow(v))}
          options={[{ value: 'arrears', label: 'In arrears only' }, { value: 'completed', label: 'Completed (all dues paid)' }]} placeholder="All subscribers" />
        <DateRangeFilter label="Enrolled" from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} />
        <Select label="Branch" value={branchFilter} onChange={setBranchFilter} options={branches.map(b => ({ value: b.id, label: b.name }))} placeholder="All" />
        <Select label="Group" value={groupFilter} onChange={setGroupFilter} options={groups.map(g => ({ value: g.id, label: g.groupName }))} placeholder="All" />
        <Select label="Area" value={areaFilter} onChange={setAreaFilter} options={[...new Set(areas.filter(a => !branchFilter || a.branchId === branchFilter).map(a => a.name))].map(n => ({ value: n, label: n }))} placeholder="All" />
        <Select label="Staff" value={staffFilter} onChange={setStaffFilter} options={users.filter(u => u.role === 'staff').map(u => ({ value: u.id, label: u.name }))} placeholder="All" />
        <Select label="Ageing" value={ageFilter} onChange={setAgeFilter} options={[{ value: '30', label: 'Up to 30 days' }, { value: '90', label: '31–90 days' }, { value: '90+', label: 'Over 90 days' }]} placeholder="All" />
      </FilterBar>
      <DataTable columns={columns} data={rows} searchKeys={['name', 'customerId', 'mobile', 'fatherSpouseName', 'panNo', 'area']} pageSize={10}
        emptyMessage={showFilter === 'completed' ? 'No subscribers have paid all their dues yet' : showFilter === 'arrears' || ageFilter ? 'No subscribers in arrears' : 'No subscribers match these filters'} />

      {/* Every detail entered in the Add Subscriber form. */}
      <Modal isOpen={!!view} onClose={() => setViewId(null)} title="Subscriber Details" size="xl">
        {view && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <CustomerAvatar name={view.name} photo={view.photo} size="md" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{view.name}</h3>
                <p className="text-sm text-gray-500">{view.customerId} · {view.mobile}</p>
              </div>
              <StatusBadge status={view.status} />
            </div>

            <DetailSection title="Group Details">
              {field('Branch', branchName(view.branchId))}
              {field('Group', viewGroup ? `${viewGroup.groupCode} · ${viewGroup.groupName}` : '')}
              {field('Group Value', viewGroup ? formatCurrency(viewGroup.groupValue) : '')}
              {field('No of Instalments', viewGroup?.duration)}
              {field('Enrolment Date', view.joiningDate)}
              {field('Collection Type', cap(view.collectionType))}
            </DetailSection>

            <DetailSection title="Customer Details">
              {field('S/O or W/O', view.fatherSpouseName)}
              {field('Rep Name', view.repName)}
              {field('PAN No', view.panNo)}
              {field('Date of Birth', view.dob)}
              {field('Mobile', view.mobile)}
              {field('Alternative Mobile', view.altMobile)}
              {field('Phone', view.phone)}
              {field('E-mail', view.email)}
              <div className="col-span-2 md:col-span-3">{field('Address', view.address)}</div>
              {field('District', view.district)}
              {field('PIN', view.pincode)}
              {field('Permanent Address', view.permanentAddress ? 'Yes' : 'No')}
              {field('Route / Area', view.area)}
              {field('Collection Staff', staffName(view.staffId))}
              {field('Agent Type', cap(view.agentType))}
              {field('Agent', agentName(view.agentId) || 'Direct')}
            </DetailSection>

            <DetailSection title="Nominee & Intimation">
              {field('Nominee Name', view.nomineeName)}
              {field('Relation', view.nomineeRelation)}
              {field('Nominee Mobile', view.nomineeMobile)}
              {field('Nominee Age', view.nomineeAge)}
              {field('Intimation By', cap(view.intimationType))}
              {field('Intimation Card', view.intimationCard ? 'Yes' : 'No')}
            </DetailSection>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-primary-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Total Due</p><p className="text-sm font-bold text-primary-700">{formatCurrency(view.totalDue)}</p></div>
              <div className="bg-success-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Paid</p><p className="text-sm font-bold text-success-700">{formatCurrency(view.paid)}</p></div>
              <div className="bg-warning-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Balance</p><p className="text-sm font-bold text-warning-700">{formatCurrency(view.pending)}</p></div>
              <div className="bg-danger-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Arrears</p><p className="text-sm font-bold text-danger-700">{formatCurrency(view.arrears)}</p>{view.arrears > 0 && <p className="text-xs text-gray-500">{view.dues} due · since {view.oldestDue}</p>}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-2">{title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3 bg-gray-50 rounded-lg p-4">{children}</div>
    </div>
  );
}

/** Searchable subscriber picker shared by the enquiry screens; remembers a customer passed in router state. */
function useSubscriberPicker() {
  const { customers } = useData();
  const location = useLocation();
  const [customerId, setCustomerId] = useState<string>((location.state as { customerId?: string } | null)?.customerId ?? '');
  const picker = (
    <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900"><Search className="w-4 h-4" /> Find Subscriber</div>
      <Select value={customerId} onChange={setCustomerId} placeholder="Select a subscriber..." className="max-w-lg"
        options={customers.map(c => ({ value: c.id, label: `${c.name} · ${c.customerId} · ${c.mobile}` }))} />
    </div>
  );
  return { customer: customers.find(c => c.id === customerId), picker };
}

/** Enquiry: every receipt and payment of one subscriber. */
export function SubscriberPayments() {
  const { collections, paymentApprovals, groups } = useData();
  const { customer, picker } = useSubscriberPicker();
  const receipts = customer ? collections.filter(c => c.customerId === customer.id) : [];
  const payments = customer ? paymentApprovals.filter(p => p.customerId === customer.id) : [];
  const chitTotal = receipts.filter(r => r.receiptType === 'chit').reduce((s, r) => s + r.collectedAmount, 0);
  const arrearTotal = receipts.filter(r => r.receiptType === 'arrear').reduce((s, r) => s + r.collectedAmount, 0);

  const columns = [
    { key: 'receiptNo', label: 'Receipt No', sortable: true, render: (c: Collection) => <span className="font-mono text-xs text-primary-600">{c.receiptNo}</span> },
    { key: 'receiptType', label: 'Type', render: (c: Collection) => <Badge variant={c.receiptType === 'arrear' ? 'danger' : 'primary'}>{c.receiptType === 'arrear' ? 'AR Receipt' : 'Chit Receipt'}</Badge> },
    { key: 'date', label: 'Date', sortable: true, render: (c: Collection) => <span>{c.date} <span className="text-gray-400">{c.time}</span></span> },
    { key: 'dueNumber', label: 'From Due', render: (c: Collection) => `#${c.dueNumber}` },
    { key: 'collectedAmount', label: 'Amount', sortable: true, render: (c: Collection) => <span className="text-success-600 font-medium">{formatCurrency(c.collectedAmount)}</span> },
    { key: 'paymentMode', label: 'Mode', render: (c: Collection) => c.paymentMode.replace('_', ' ').toUpperCase() },
    { key: 'referenceNo', label: 'Reference', render: (c: Collection) => <span className="font-mono text-xs text-gray-500">{c.referenceNo || '-'}</span> },
    { key: 'staffName', label: 'Collected By' },
    { key: 'status', label: 'Status', render: (c: Collection) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Subscriber Payments" subtitle="System enquiry — all receipts and payments of a subscriber" actions={customer && <ExportButtons filename={`payments-${customer.customerId}`} rows={receipts} />} />
      {picker}
      {customer ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <KPICard title="Chit Receipts" value={formatCurrency(chitTotal)} icon={<Receipt className="w-6 h-6" />} color="primary" />
            <KPICard title="AR Receipts" value={formatCurrency(arrearTotal)} icon={<HandCoins className="w-6 h-6" />} color="gold" />
            <KPICard title="Total Paid" value={formatCurrency(customer.paid)} icon={<Wallet className="w-6 h-6" />} color="success" />
            <KPICard title="Balance" value={formatCurrency(customer.pending)} icon={<AlertCircle className="w-6 h-6" />} color="danger" />
          </div>
          <p className="text-sm text-gray-500 mb-2">{customer.name} · {groups.find(g => g.id === customer.groupId)?.groupName ?? 'No group'} · {receipts.length} receipts</p>
          <DataTable columns={columns} data={receipts} searchKeys={['receiptNo', 'referenceNo']} pageSize={10} emptyMessage="No receipts yet" />
          {payments.length > 0 && (
            <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Bank / UPI payments informed</h3>
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                    <span className="font-mono text-xs text-primary-600">{p.paymentId}</span>
                    <span>{p.submittedTime}</span>
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                    <StatusBadge status={p.currentStage} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : <p className="text-sm text-gray-400 text-center py-12">Select a subscriber to see their payments.</p>}
    </div>
  );
}

/** Enquiry: one subscriber's full profile — details, dues, auction and transfers. */
export function SubscriberProfile() {
  const { branches, groups, users, agents, dueSchedules, auctions, customerTransfers, today } = useData();
  const { customer, picker } = useSubscriberPicker();
  const dues = customer ? dueSchedules.filter(d => d.customerId === customer.id) : [];
  const arrears = dues.filter(d => d.pendingAmount > 0 && d.dueDate < today).reduce((s, d) => s + d.pendingAmount, 0);
  const won = customer && auctions.find(a => a.customerId === customer.id && a.groupId === customer.groupId);
  const transfers = customer ? customerTransfers.filter(t => t.customerId === customer.id) : [];
  const group = customer && groups.find(g => g.id === customer.groupId);

  const dueColumns = [
    { key: 'dueNumber', label: 'Due #', sortable: true },
    { key: 'dueDate', label: 'Due Date', sortable: true },
    { key: 'dueAmount', label: 'Amount', render: (d: DueSchedule) => formatCurrency(d.dueAmount) },
    { key: 'paidAmount', label: 'Paid', render: (d: DueSchedule) => <span className="text-success-600">{formatCurrency(d.paidAmount)}</span> },
    { key: 'pendingAmount', label: 'Balance', render: (d: DueSchedule) => <span className={d.pendingAmount > 0 ? 'text-danger-600 font-medium' : ''}>{formatCurrency(d.pendingAmount)}</span> },
    { key: 'paymentDate', label: 'Paid On', render: (d: DueSchedule) => d.paymentDate ?? '-' },
    { key: 'receiptNo', label: 'Receipt', render: (d: DueSchedule) => <span className="font-mono text-xs text-primary-600">{d.receiptNo || '-'}</span> },
    { key: 'status', label: 'Status', render: (d: DueSchedule) => <StatusBadge status={d.status} /> },
  ];

  const field = (label: string, value: string) => <div><p className="text-gray-500 text-xs">{label}</p><p className="font-medium">{value || '-'}</p></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Subscriber Profile" subtitle="System enquiry — complete subscriber details" actions={customer && <ExportButtons filename={`dues-${customer.customerId}`} rows={dues} />} />
      {picker}
      {customer ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6">
            <div className="flex items-center gap-4 pb-4 mb-4 border-b border-gray-100">
              <CustomerAvatar name={customer.name} photo={customer.photo} size="lg" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">{customer.name}</h3>
                <p className="text-sm text-gray-500">{customer.customerId} • {customer.mobile}</p>
              </div>
              <StatusBadge status={customer.status} />
              {won && <Badge variant="gold"><Trophy className="w-3 h-3 mr-1" /> Prized</Badge>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {field('Father / Spouse', customer.fatherSpouseName)}
              {field('Alt. Mobile', customer.altMobile)}
              {field('Branch', branches.find(b => b.id === customer.branchId)?.name ?? '')}
              {field('Area', customer.area)}
              {field('Group', group ? `${group.groupName} (${group.groupCode})` : '')}
              {field('Collection Staff', users.find(u => u.id === customer.staffId)?.name ?? '')}
              {field('Agent', agents.find(a => a.id === customer.agentId)?.name ?? 'Direct')}
              {field('Joining Date', customer.joiningDate)}
              <div className="col-span-2 md:col-span-4">{field('Address', customer.address)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Total Due" value={formatCurrency(customer.totalDue)} icon={<Receipt className="w-6 h-6" />} color="primary" />
            <KPICard title="Paid" value={formatCurrency(customer.paid)} icon={<Wallet className="w-6 h-6" />} color="success" />
            <KPICard title="Arrears" value={formatCurrency(arrears)} icon={<AlertCircle className="w-6 h-6" />} color="danger" />
            <KPICard title="Balance" value={formatCurrency(customer.pending)} icon={<Clock className="w-6 h-6" />} color="warning" />
          </div>

          {won && (
            <div className="bg-gold-50 border border-gold-200 rounded-xl p-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              {field('Auction', `${won.auctionCode} · #${won.auctionNo}`)}
              {field('Auction Date', won.auctionDate)}
              {field('Bid Amount', formatCurrency(won.bidAmount))}
              {field('Prize Amount', formatCurrency(won.prizeAmount))}
              {field('Payout', won.payoutStatus === 'paid' ? `Paid ${won.paidDate}` : 'Pending')}
            </div>
          )}

          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Installments</h3>
            <DataTable columns={dueColumns} data={dues} searchable={false} pageSize={12} emptyMessage="No installments" />
          </div>

          {transfers.length > 0 && (
            <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Transfer history</h3>
              {transfers.map(t => (
                <p key={t.id} className="text-sm text-gray-600 py-1">{t.date}: {groups.find(g => g.id === t.fromGroupId)?.groupName ?? '-'} → {groups.find(g => g.id === t.toGroupId)?.groupName ?? '-'} · {t.reason}</p>
              ))}
            </div>
          )}
        </div>
      ) : <p className="text-sm text-gray-400 text-center py-12">Select a subscriber to see their profile.</p>}
    </div>
  );
}
