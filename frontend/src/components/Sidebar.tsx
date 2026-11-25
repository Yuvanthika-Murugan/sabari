import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, Building2, UserCircle, UsersRound,
  Landmark, Clock, FileText, Bell, Settings,
  ChevronDown, ChevronRight, FileSpreadsheet, Receipt,
  CreditCard, ClipboardList, BarChart3, ScrollText, CheckCircle2,
  UserPlus, List, ArrowRightLeft, CalendarDays, HandCoins, FileBarChart,
  Coins, Building, Landmark as LandmarkIcon, ArrowDownToLine,
  AlertCircle, UserCheck, CalendarClock, CalendarPlus, MapPin, Handshake,
  Gavel, BadgePercent, Wrench, LogIn, Search, IdCard, Database,
  PanelLeftClose, Hash, X,
} from 'lucide-react';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/PhotoInput';
import { BRAND } from '@/lib/brand';
import type { Role } from '@/types';

interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  /** Sub-entries; one with its own roles is shown only to those roles. */
  children?: { label: string; path: string; icon: typeof LayoutDashboard; roles?: Role[] }[];
  /** Roles that see this entry; everyone when omitted. */
  roles?: Role[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const OFFICE: Role[] = ['md', 'admin', 'manager'];
const ADMIN: Role[] = ['md', 'admin'];

const navSections: NavSection[] = [
  { items: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }] },
  {
    title: 'Master Data',
    items: [
      {
        label: 'Customers', path: '/customers', icon: UserCircle,
        children: [
          { label: 'Customer Add', path: '/customers/add', icon: UserPlus },
          { label: 'Customer List', path: '/customers/list', icon: List },
          { label: 'Customer Transfer', path: '/customers/transfer', icon: ArrowRightLeft },
        ],
      },
      { label: 'AR Subscribers', path: '/subscribers/arrears', icon: AlertCircle },
      {
        label: 'Chit Groups', path: '/groups', icon: UsersRound,
        children: [
          { label: 'Chit Group Code', path: '/groups/codes', icon: Hash },
          { label: 'Chit Group Create', path: '/groups/create', icon: CalendarPlus },
          { label: 'Group List', path: '/groups/list', icon: List },
          { label: 'Group-wise Customers', path: '/groups/customers', icon: UsersRound },
        ],
      },
    ],
  },
  {
    title: 'Company',
    items: [
      { label: 'Company Profile', path: '/settings', icon: Settings },
      { label: 'Login History', path: '/company/logins', icon: LogIn, roles: ADMIN },
      {
        label: 'Setup', path: '/setup', icon: Wrench, roles: OFFICE,
        children: [
          { label: 'Branch', path: '/branches', icon: Building2 },
          { label: 'Commission', path: '/setup/commission', icon: BadgePercent },
        ],
      },
      {
        // Managers see only Agents and Areas here; user accounts are MD / Admin only.
        label: 'Users', path: '/users', icon: Users, roles: OFFICE,
        children: [
          { label: 'All Users', path: '/users', icon: Users, roles: ADMIN },
          { label: 'Admin', path: '/users/admin', icon: UserCheck, roles: ADMIN },
          { label: 'Agents', path: '/agents', icon: Handshake },
          { label: 'Areas', path: '/areas', icon: MapPin },
        ],
      },
    ],
  },
  {
    title: 'Transaction Data',
    items: [
      { label: 'AR Receipt', path: '/receipts/arrear', icon: HandCoins },
      { label: 'Chit Receipt', path: '/receipts/chit', icon: Receipt },
      { label: 'Auction', path: '/auctions', icon: Gavel, roles: OFFICE },
      {
        label: 'Payment', path: '/payments', icon: CreditCard,
        children: [
          { label: 'Payment Entry', path: '/payments/entry', icon: CreditCard },
          { label: 'Voucher Entry', path: '/payments/voucher', icon: ClipboardList },
          { label: 'Payment Approval', path: '/payments/approval', icon: CheckCircle2 },
        ],
      },
      {
        label: 'Collections', path: '/collections', icon: CalendarDays,
        children: [
          { label: "Today's Collection", path: '/collections/today', icon: CalendarDays },
          { label: 'Collection Statement', path: '/collections/statement', icon: FileText },
          { label: 'Collection Summary', path: '/collections/summary', icon: FileBarChart },
        ],
      },
    ],
  },
  {
    title: 'System Enquiry',
    items: [
      { label: 'Subscriber Payments', path: '/enquiry/payments', icon: Search },
      { label: 'Subscriber Profile', path: '/enquiry/profile', icon: IdCard },
    ],
  },
  {
    title: 'Master Report',
    items: [
      { label: 'Master Report', path: '/reports/master', icon: Database, roles: OFFICE },
      { label: 'All Reports', path: '/reports', icon: BarChart3 },
      {
        label: 'Pending', path: '/pending', icon: Clock,
        children: [
          { label: 'Customer Pending', path: '/pending/customer', icon: AlertCircle },
          { label: 'Staff-wise Pending', path: '/pending/staff', icon: UserCircle },
          { label: 'Branch-wise Pending', path: '/pending/branch', icon: Building },
          { label: 'Group-wise Pending', path: '/pending/group', icon: UsersRound },
        ],
      },
      { label: 'Statements', path: '/statements', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Account Data',
    items: [
      {
        label: 'Cash & Bank', path: '/cash-bank', icon: Landmark, roles: OFFICE,
        children: [
          { label: 'Cash Statement', path: '/cash-bank/cash', icon: Coins },
          { label: 'Bank Accounts', path: '/cash-bank/accounts', icon: LandmarkIcon },
          { label: 'Bank Statement', path: '/cash-bank/statement', icon: FileText },
          { label: 'Withdrawal', path: '/cash-bank/withdrawal', icon: ArrowDownToLine },
        ],
      },
      { label: 'Day End', path: '/day-end', icon: CalendarClock, roles: OFFICE },
    ],
  },
  {
    title: 'Auditing Data',
    items: [
      { label: 'Audit Log', path: '/audit', icon: ScrollText, roles: OFFICE },
      { label: 'Notifications', path: '/notifications', icon: Bell },
    ],
  },
];

const allItems = navSections.flatMap(s => s.items);

export default function Sidebar() {
  const { sidebarCollapsed: collapsedPref, toggleSidebar, currentUser, mobileNavOpen, setMobileNavOpen } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  // Laptop/desktop: docked sidebar that can collapse to icons.
  // Phone/tablet: full-width drawer that slides in from the left (never icon-only).
  const isDesktop = useIsDesktop();
  const sidebarCollapsed = collapsedPref && isDesktop;

  // Close the drawer after navigating, and on Esc.
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname, setMobileNavOpen]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileNavOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [mobileNavOpen, setMobileNavOpen]);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    allItems.forEach(item => {
      if (item.children && item.children.some(c => location.pathname === c.path)) {
        initial[item.label] = true;
      }
    });
    return initial;
  });

  const toggleMenu = (label: string) => {
    if (sidebarCollapsed) { toggleSidebar(); return; }
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const visible = (item: { roles?: Role[] }) => !item.roles || (currentUser && item.roles.includes(currentUser.role));

  const renderItem = (item: NavItem) => {
    const hasChildren = !!item.children;
    const isOpen = openMenus[item.label];
    const isActiveParent = hasChildren && item.children!.some(c => location.pathname === c.path);

    return (
      <div key={item.label}>
        {hasChildren ? (
          <>
            <button
              onClick={() => toggleMenu(item.label)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-primary-800 ${sidebarCollapsed ? 'justify-center' : ''} ${
                isActiveParent ? 'text-gold-400 bg-primary-800/50' : 'text-gray-300'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left whitespace-nowrap">{item.label}</span>
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </>
              )}
            </button>
            {!sidebarCollapsed && isOpen && (
              <div className="bg-primary-900/50">
                {item.children!.filter(visible).map(child => (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-3 pl-12 pr-4 py-2 text-sm transition-colors ${
                        isActive ? 'text-gold-400 bg-primary-800/30 border-l-2 border-gold-400' : 'text-gray-400 hover:text-white hover:bg-primary-800/30'
                      }`
                    }
                  >
                    <child.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{child.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </>
        ) : (
          <NavLink
            to={item.path}
            end
            title={sidebarCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${sidebarCollapsed ? 'justify-center' : ''} ${
                isActive ? 'text-gold-400 bg-primary-800/50 border-l-2 border-gold-400' : 'text-gray-300 hover:bg-primary-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </NavLink>
        )}
      </div>
    );
  };

  return (
    <>
    {/* Backdrop behind the drawer on phones/tablets; tap to close. */}
    {mobileNavOpen && !isDesktop && (
      <div className="fixed inset-0 z-40 bg-primary-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
    )}
    <aside
      className={`${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} w-72 max-w-[85vw] bg-primary-950 text-white flex flex-col transition-all duration-300 flex-shrink-0 h-[100dvh] lg:h-screen
        fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      aria-label="Main navigation"
    >
      <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'} px-4 py-4 border-b border-primary-800`}>
        <div className="flex items-center gap-3 overflow-hidden">
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center flex-shrink-0 shadow-glow hover:brightness-110 transition"
            >
              <Landmark className="w-6 h-6 text-primary-950" />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center flex-shrink-0 shadow-glow">
              <Landmark className="w-6 h-6 text-primary-950" />
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h1 className="text-[13px] font-bold text-white leading-tight whitespace-nowrap" title={BRAND.name}>{BRAND.line1}</h1>
              <p className="text-[13px] font-bold text-gold-400 leading-tight whitespace-nowrap">{BRAND.line2}</p>
            </div>
          )}
        </div>
        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={isDesktop ? toggleSidebar : () => setMobileNavOpen(false)}
            title={isDesktop ? 'Collapse sidebar' : 'Close menu'}
            aria-label={isDesktop ? 'Collapse sidebar' : 'Close menu'}
            className="p-2 rounded-lg text-primary-200 hover:text-white hover:bg-primary-800 transition-colors flex-shrink-0"
          >
            {isDesktop ? <PanelLeftClose className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {navSections.map((section, i) => {
          const items = section.items.filter(visible);
          if (!items.length) return null;
          return (
            <div key={section.title ?? i} className={i > 0 ? 'mt-2' : ''}>
              {section.title && (sidebarCollapsed
                ? <div className="mx-4 my-2 border-t border-primary-800" />
                : <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-primary-300/70">{section.title}</p>)}
              {items.map(renderItem)}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-primary-800 p-2">
        <button
          type="button"
          onClick={() => navigate('/settings', { state: { tab: 'profile' } })}
          title="My Profile"
          aria-label="Open my profile"
          className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors hover:bg-primary-800 ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <Avatar name={currentUser?.name ?? 'User'} photo={currentUser?.photo} className="w-9 h-9 text-sm bg-gold-500 text-primary-950" />
          {!sidebarCollapsed && (
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium text-white truncate">{currentUser?.name ?? 'User'}</p>
              <p className="text-xs text-gold-400 capitalize">{currentUser?.role === 'md' ? 'Managing Director' : currentUser?.role ?? 'guest'}</p>
            </div>
          )}
          {!sidebarCollapsed && <ChevronRight className="w-4 h-4 text-primary-300 flex-shrink-0" />}
        </button>
      </div>
    </aside>
    </>
  );
}
