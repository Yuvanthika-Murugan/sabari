import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import LogoutButton from '@/components/LogoutButton';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/PhotoInput';
import { useData } from '@/context/DataContext';


export default function Header() {
  const { currentUser, setMobileNavOpen } = useApp();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { customers, groups, users, collections, paymentApprovals } = useData();
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
          <NotificationBell />

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
              </div>
            )}
          </div>

          {/* Always visible, red, and the same in every panel. */}
          <span className="hidden sm:block w-px h-8 bg-gray-200" aria-hidden="true" />
          <LogoutButton tone="light" compact />
        </div>
      </div>
    </header>
  );
}
