import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from '@/context/AppContext';
import { DataProvider } from '@/context/DataContext';
import { ToastProvider } from '@/context/ToastContext';
import Layout from '@/components/Layout';
import StaffLayout from '@/components/StaffLayout';
import StaffCollect from '@/pages/StaffCollect';
import Login from '@/pages/Login';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import UserManagement from '@/pages/UserManagement';
import Branches from '@/pages/Branches';
import CustomerList from '@/pages/CustomerList';
import CustomerTransfer from '@/pages/CustomerTransfer';
import { GroupList, GroupWiseCustomers } from '@/pages/Groups';
import GroupCodes from '@/pages/GroupCodes';
import { TodaysCollection, CollectionStatement, CollectionSummary } from '@/pages/Collections';
import { PaymentApproval, PaymentEntry, VoucherEntry } from '@/pages/Payments';
import { CashStatement, BankAccounts, BankStatement } from '@/pages/CashBank';
import { CustomerPending, StaffWisePending, BranchWisePending, GroupWisePending } from '@/pages/Pending';
import { Statements, DayEnd } from '@/pages/Statements';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import AuditLog from '@/pages/AuditLog';
import Settings from '@/pages/Settings';
import StaffDashboard from '@/pages/StaffDashboard';
import Agents from '@/pages/Agents';
import Areas from '@/pages/Areas';
import Auctions from '@/pages/Auctions';
import ReceiptEntry from '@/pages/ReceiptEntry';
import Expenses from '@/pages/Expenses';
import SuperAdmin from '@/pages/SuperAdmin';
import Settlements from '@/pages/Settlements';
import SuperAdminLayout from '@/components/SuperAdminLayout';
import { ArrearSubscribers, SubscriberProfile } from '@/pages/Subscribers';
import { CommissionSetup, LoginHistory } from '@/pages/Company';
import type { JSX } from 'react';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { currentUser } = useApp();
  const location = useLocation();
  if (!currentUser) return <Navigate to="/login" state={{ from: location }} replace />;
  // Collection staff get a sidebar-free layout made for phones in the field.
  return currentUser.role === 'staff' ? <StaffLayout>{children}</StaffLayout> : <Layout>{children}</Layout>;
}

/** Admin-panel pages (cash & bank books, day end, audit log, user accounts, login history): MD and Admin only. */
function AdminRoute({ children }: { children: JSX.Element }) {
  const { currentUser } = useApp();
  if (currentUser && currentUser.role !== 'md' && currentUser.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

function AppRoutes() {
  const { currentUser, restoring } = useApp();

  if (restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Routes>
        {/* Public home page; any other address asks the visitor to sign in. */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        {/* Everyone, the Super Admin (MD) included, signs in on the one /login form. */}
        <Route path="/super-admin/*" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isStaff = currentUser.role === 'staff';
  // The MD is the Super Admin: their panel is the Super Admin (MD) panel.
  const superAdmin = currentUser.role === 'md';
  // Where a signed-in user starts: MD on the Super Admin panel, staff / agents on the
  // collection screen, everyone else on the Admin panel dashboard.
  const home = superAdmin ? '/super-admin' : isStaff ? '/collect' : '/dashboard';

  return (
    <DataProvider key={currentUser.id}>
    <Routes>
      <Route path="/login" element={<Navigate to={home} replace />} />
      {/* Super Admin (MD) panel: stand-alone layout, MD only. */}
      <Route path="/super-admin/login" element={<Navigate to={home} replace />} />
      <Route path="/super-admin" element={superAdmin ? <SuperAdminLayout><SuperAdmin /></SuperAdminLayout> : <Navigate to={home} replace />} />
      <Route path="/super-admin/users" element={superAdmin ? <SuperAdminLayout><UserManagement /></SuperAdminLayout> : <Navigate to={home} replace />} />
      <Route path="/super-admin/settlements" element={superAdmin ? <SuperAdminLayout><Settlements panel="superadmin" /></SuperAdminLayout> : <Navigate to={home} replace />} />
      <Route path="/super-admin/bids" element={superAdmin ? <SuperAdminLayout><Auctions panel="superadmin" /></SuperAdminLayout> : <Navigate to={home} replace />} />
      {/* Chit settlements: Admin pays out what the Super Admin approved. */}
      <Route path="/payments/settlements" element={<AdminRoute><Settlements panel="admin" /></AdminRoute>} />
      <Route path="/collect" element={<ProtectedRoute>{isStaff ? <StaffCollect /> : <Navigate to="/dashboard" replace />}</ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute>{isStaff ? <StaffDashboard /> : <Dashboard />}</ProtectedRoute>} />
      <Route path="/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
      <Route path="/users/admin" element={<AdminRoute><UserManagement roleFilter="admin" /></AdminRoute>} />
      <Route path="/users/manager" element={<ProtectedRoute><UserManagement roleFilter="manager" /></ProtectedRoute>} />
      <Route path="/users/staff" element={<ProtectedRoute><UserManagement roleFilter="staff" /></ProtectedRoute>} />
      <Route path="/branches" element={<ProtectedRoute><Branches /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
      <Route path="/customers/add" element={<ProtectedRoute><CustomerList key="add" /></ProtectedRoute>} />
      <Route path="/customers/list" element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
      <Route path="/customers/transfer" element={<ProtectedRoute><CustomerTransfer /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><GroupList /></ProtectedRoute>} />
      <Route path="/groups/create" element={<ProtectedRoute><GroupList key="create" /></ProtectedRoute>} />
      <Route path="/groups/list" element={<ProtectedRoute><GroupList /></ProtectedRoute>} />
      <Route path="/groups/customers" element={<ProtectedRoute><GroupWiseCustomers /></ProtectedRoute>} />
      <Route path="/groups/codes" element={<ProtectedRoute><GroupCodes /></ProtectedRoute>} />
      <Route path="/collections/today" element={<ProtectedRoute><TodaysCollection /></ProtectedRoute>} />
      <Route path="/collections/entry" element={<ProtectedRoute><TodaysCollection key="entry" /></ProtectedRoute>} />
      <Route path="/collections/statement" element={<ProtectedRoute><CollectionStatement /></ProtectedRoute>} />
      <Route path="/collections/summary" element={<ProtectedRoute><CollectionSummary /></ProtectedRoute>} />
      <Route path="/payments/entry" element={<ProtectedRoute><PaymentEntry /></ProtectedRoute>} />
      <Route path="/payments/voucher" element={<ProtectedRoute><VoucherEntry /></ProtectedRoute>} />
      <Route path="/payments/approval" element={<ProtectedRoute><PaymentApproval /></ProtectedRoute>} />
      <Route path="/cash-bank/cash" element={<AdminRoute><CashStatement /></AdminRoute>} />
      <Route path="/cash-bank/accounts" element={<AdminRoute><BankAccounts /></AdminRoute>} />
      <Route path="/cash-bank/statement" element={<AdminRoute><BankStatement /></AdminRoute>} />
      <Route path="/pending/customer" element={<ProtectedRoute><CustomerPending /></ProtectedRoute>} />
      <Route path="/pending/staff" element={<ProtectedRoute><StaffWisePending /></ProtectedRoute>} />
      <Route path="/pending/branch" element={<ProtectedRoute><BranchWisePending /></ProtectedRoute>} />
      <Route path="/pending/group" element={<ProtectedRoute><GroupWisePending /></ProtectedRoute>} />
      <Route path="/statements" element={<ProtectedRoute><Statements /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/day-end" element={<AdminRoute><DayEnd /></AdminRoute>} />
      <Route path="/audit" element={<AdminRoute><AuditLog /></AdminRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
      <Route path="/areas" element={<ProtectedRoute><Areas /></ProtectedRoute>} />
      <Route path="/subscribers/arrears" element={<ProtectedRoute><ArrearSubscribers /></ProtectedRoute>} />
      <Route path="/company/logins" element={<AdminRoute><LoginHistory /></AdminRoute>} />
      <Route path="/setup/commission" element={<ProtectedRoute><CommissionSetup /></ProtectedRoute>} />
      <Route path="/receipts/entry" element={<ProtectedRoute><ReceiptEntry /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
      <Route path="/auctions" element={<ProtectedRoute><Auctions /></ProtectedRoute>} />
      <Route path="/enquiry/profile" element={<ProtectedRoute><SubscriberProfile /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
    </DataProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </ToastProvider>
  );
}
