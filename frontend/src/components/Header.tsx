import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, Check, Menu } from 'lucide-react';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/PhotoInput';
import { useData } from '@/context/DataContext';
import { notificationColors, useNotificationActions } from '@/hooks/useNotifications';


export default function Header() {
  const { currentUser, logout, setMobileNavOpen } = useApp();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { notifications: notifList, customers, groups, users, collections, paymentApprovals } = useData();
  const { markRead, markAllRead } = useNotificationActions();
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifList.filter(n => !n.read).length;

  const searchIndex = useMemo(() => [
    ...customers.map(c => ({ label: c.name, sub: `${c.customerId} · ${c.mobile}`, path: '/customers/list' })),
    ...groups.map(g => ({ label: g.groupName, sub: g.groupCode, path: '/groups/list' })),
    ...users.filter(u => u.role === 'staff').map(u => ({ label: u.name, sub: u.empId, path: '/users/staff' })),
    ...collections.map(c => ({ label: c.receiptNo, sub: `Receipt · ${c.customerName}`, path: '/collections/statement' })),
    ...paymentApprovals.map(p => ({ label: p.paymentId, sub: `Payment ${p.referenceNo ? '· ' + p.referenceNo : ''}`, path: '/payments/approval' })),
  ], [customers, groups, users, collections, paymentApprovals]);

  const q = searchQuery.trim().toLowerCase();
  const filteredSearch = q
    ? searchIndex.filter(r => r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q)).slice(0, 12)
    : [];

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 gap-2 sm:gap-4">
        {/* Phones/tablets: opens the navigation drawer. */}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div ref={searchRef} className="flex-1 min-w-0 max-w-xl relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder={isDesktop ? 'Search customers, receipts, groups, staff, payment references...' : 'Search...'}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>
          {showSearch && q && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-cardLg border border-gray-100 py-2 max-h-80 overflow-y-auto scrollbar-thin z-40">
              <p className="px-4 py-1.5 text-xs font-medium text-gray-400 uppercase">Quick Search</p>
              {filteredSearch.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { navigate(r.path); setShowSearch(false); setSearchQuery(''); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Search className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.label}</p>
                    <p className="text-xs text-gray-400">{r.sub}</p>
                  </div>
                </button>
              ))}
              {filteredSearch.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400">No results found</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 bg-white rounded-xl shadow-cardLg border border-gray-100 z-40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <button onClick={() => { navigate('/notifications'); setShowNotif(false); }} className="text-sm font-semibold text-gray-900 hover:text-primary-700">Notifications</button>
                  <button onClick={markAllRead} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                </div>
                <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto scrollbar-thin">
                  {notifList.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications</p>}
                  {notifList.slice(0, 20).map(n => (
                    <button
                      key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${!n.read ? 'bg-primary-50/30' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${notificationColors[n.type]}`}>
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div ref={profileRef} className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Avatar name={currentUser?.name ?? 'User'} photo={currentUser?.photo} className="w-8 h-8 text-sm bg-gradient-to-br from-primary-600 to-primary-800 text-white" />
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900">{currentUser?.name ?? 'User'}</p>
                <p className="text-xs text-gray-500 capitalize">{currentUser?.role === 'md' ? 'Managing Director' : currentUser?.role ?? 'guest'}</p>
              </div>
            </button>
            {showProfile && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-cardLg border border-gray-100 py-2 z-40">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{currentUser?.name}</p>
                  <p className="text-xs text-gray-500">{currentUser?.email}</p>
                </div>
                <button onClick={() => { navigate('/settings', { state: { tab: 'profile' } }); setShowProfile(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  My Profile
                </button>
                <button onClick={() => { navigate('/settings'); setShowProfile(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  Settings
                </button>
                <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors flex items-center gap-2">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
