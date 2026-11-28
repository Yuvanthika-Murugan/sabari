import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, Activity, Users, HandCoins, Gavel } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { Avatar } from '@/components/PhotoInput';
import LogoutButton from '@/components/LogoutButton';
import NotificationBell from '@/components/NotificationBell';
import type { Notification } from '@/types';
import { BRAND } from '@/lib/brand';

/** Sections of the Super Admin (MD) panel, shown as tabs under the top bar. */
const TABS = [
  { to: '/super-admin', label: 'Overview', icon: Activity },
  { to: '/super-admin/settlements', label: 'Chit Settlements', icon: HandCoins },
  { to: '/super-admin/bids', label: 'Bid Approvals', icon: Gavel },
  { to: '/super-admin/users', label: 'User Management', icon: Users },
];

/** Which Super Admin tab a notification is about. */
const linkFor = (n: Notification) => /bid/i.test(n.title) ? '/super-admin/bids' : /settlement/i.test(n.title) ? '/super-admin/settlements' : undefined;

/** Stand-alone frame for the Super Admin Panel: its own top bar, no main-app sidebar. */
export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { currentUser } = useApp();
  const { settlements, bidPayments } = useData();
  // Requests waiting for the Super Admin's decision, shown on the tab.
  const waiting = settlements.filter(s => s.status === 'requested').length;
  const bidWaiting = bidPayments.filter(p => p.status === 'verified' || p.status === 'documented').length;
  const navigate = useNavigate();
  // Opens the Admin panel to view it; the Super Admin session stays open, so the
  // "Back to Super Admin Panel" bar there returns here without signing in again.
  const toMainApp = () => navigate('/dashboard');

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-gray-950 via-primary-950 to-gray-900 text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-primary-950" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-bold truncate">{BRAND.line1} {BRAND.line2}</p>
              <p className="text-[11px] font-semibold tracking-widest text-gold-400 uppercase">Super Admin · MD Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={toMainApp} className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-sm text-gray-200 hover:bg-white/10" title="Open the Admin panel (the main application)">
              <LayoutDashboard className="w-4 h-4" /> Admin Panel
            </button>
            <NotificationBell tone="dark" linkFor={linkFor} allLink={null} />
            {currentUser && (
              <div className="hidden md:flex items-center gap-2">
                <Avatar name={currentUser.name} photo={currentUser.photo} className="w-8 h-8 text-xs bg-gold-500 text-primary-950" />
                <div className="leading-tight">
                  <p className="text-sm font-medium">{currentUser.name}</p>
                  <p className="text-[11px] text-gold-400">Super Admin · MD</p>
                </div>
              </div>
            )}
            <span className="hidden sm:block w-px h-8 bg-white/15" aria-hidden="true" />
            <LogoutButton tone="dark" compact />
          </div>
        </div>
        <nav className="border-t border-white/10" aria-label="Super Admin sections">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map(t => (
              <NavLink key={t.to} to={t.to} end
                className={({ isActive }) => `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${isActive
                  ? 'border-gold-400 text-gold-400' : 'border-transparent text-gray-300 hover:text-white'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
                {(t.to === '/super-admin/settlements' ? waiting : t.to === '/super-admin/bids' ? bidWaiting : 0) > 0 && (
                  <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-danger-500 text-white text-[11px] font-bold flex items-center justify-center">{t.to === '/super-admin/bids' ? bidWaiting : waiting}</span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
