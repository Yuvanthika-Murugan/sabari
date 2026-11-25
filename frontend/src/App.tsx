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
import { CashStatement, BankAccounts, BankStatement, WithdrawalStatement } from '@/pages/CashBank';
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
import MasterReport from '@/pages/MasterReport';
import { ChitReceipt, ArrearReceipt } from '@/pages/Receipts';
import { ArrearSubscribers, SubscriberPayments, SubscriberProfile } from '@/pages/Subscribers';
import { CommissionSetup, LoginHistory } from '@/pages/Company';
import type { JSX } from 'react';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { currentUser } = useApp();
  const location = useLocation();
  if (!currentUser) return <Navigate to="/login" state={{ from: location }} replace />;
  // Collection staff get a sidebar-free layout made for phones in the field.
  return currentUser.role === 'staff' ? <StaffLayout>{children}</StaffLayout> : <Layout>{children}</Layout>;
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isStaff = currentUser.role === 'staff';

  return (
    <DataProvider key={currentUser.id}>
    <Routes>
      <Route path="/login" element={<Navigate to={isStaff ? '/collect' : '/dashboard'} replace />} />
      <Route path="/collect" element={<ProtectedRoute>{isStaff ? <StaffCollect /> : <Navigate to="/dashboard" replace />}</ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute>{isStaff ? <StaffDashboard /> : <Dashboard />}</ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
      <Route path="/users/admin" element={<ProtectedRoute><UserManagement roleFilter="admin" /></ProtectedRoute>} />
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
      <Route path="/cash-bank/cash" element={<ProtectedRoute><CashStatement /></ProtectedRoute>} />
      <Route path="/cash-bank/accounts" element={<ProtectedRoute><BankAccounts /></ProtectedRoute>} />
      <Route path="/cash-bank/statement" element={<ProtectedRoute><BankStatement /></ProtectedRoute>} />
      <Route path="/cash-bank/withdrawal" element={<ProtectedRoute><WithdrawalStatement /></ProtectedRoute>} />
      <Route path="/pending/customer" element={<ProtectedRoute><CustomerPending /></ProtectedRoute>} />
      <Route path="/pending/staff" element={<ProtectedRoute><StaffWisePending /></ProtectedRoute>} />
      <Route path="/pending/branch" element={<ProtectedRoute><BranchWisePending /></ProtectedRoute>} />
      <Route path="/pending/group" element={<ProtectedRoute><GroupWisePending /></ProtectedRoute>} />
      <Route path="/statements" element={<ProtectedRoute><Statements /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/day-end" element={<ProtectedRoute><DayEnd /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
      <Route path="/areas" element={<ProtectedRoute><Areas /></ProtectedRoute>} />
      <Route path="/subscribers/arrears" element={<ProtectedRoute><ArrearSubscribers /></ProtectedRoute>} />
      <Route path="/company/logins" element={<ProtectedRoute><LoginHistory /></ProtectedRoute>} />
      <Route path="/setup/commission" element={<ProtectedRoute><CommissionSetup /></ProtectedRoute>} />
      <Route path="/receipts/chit" element={<ProtectedRoute><ChitReceipt /></ProtectedRoute>} />
      <Route path="/receipts/arrear" element={<ProtectedRoute><ArrearReceipt /></ProtectedRoute>} />
      <Route path="/auctions" element={<ProtectedRoute><Auctions /></ProtectedRoute>} />
      <Route path="/enquiry/payments" element={<ProtectedRoute><SubscriberPayments /></ProtectedRoute>} />
      <Route path="/enquiry/profile" element={<ProtectedRoute><SubscriberProfile /></ProtectedRoute>} />
      <Route path="/reports/master" element={<ProtectedRoute><MasterReport /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={isStaff ? '/collect' : '/dashboard'} replace />} />
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
