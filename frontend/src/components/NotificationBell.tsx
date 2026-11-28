import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { notificationColors, useNotificationActions } from '@/hooks/useNotifications';
import type { Notification } from '@/types';

/**
 * Bell with the unread count and a drop-down of the latest notifications.
 * tone="dark" for a dark header (Super Admin panel). linkFor, when given, opens the
 * page a notification is about; allLink is where "Notifications" goes (none hides it).
 */
export default function NotificationBell({ tone = 'light', linkFor, allLink = '/notifications' }: {
  tone?: 'light' | 'dark';
  linkFor?: (n: Notification) => string | undefined;
  allLink?: string | null;
}) {
  const { notifications } = useData();
  const { markRead, markAllRead } = useNotificationActions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = (n: Notification) => {
    if (!n.read) markRead(n.id);
    const to = linkFor?.(n);
    if (to) { navigate(to); setOpen(false); }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        className={`relative p-2 rounded-lg transition-colors ${tone === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
        <Bell className={`w-5 h-5 ${tone === 'dark' ? 'text-gray-200' : 'text-gray-600'}`} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-danger-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 bg-white rounded-xl shadow-cardLg border border-gray-100 z-40 overflow-hidden text-left">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            {allLink
              ? <button onClick={() => { navigate(allLink); setOpen(false); }} className="text-sm font-semibold text-gray-900 hover:text-primary-700">Notifications</button>
              : <p className="text-sm font-semibold text-gray-900">Notifications</p>}
            <button onClick={markAllRead} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              <Check className="w-3 h-3" /> Mark all read
            </button>
          </div>
          <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-400">No notifications</p>}
            {notifications.slice(0, 20).map(n => (
              <button key={n.id} onClick={() => pick(n)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${!n.read ? 'bg-primary-50/30' : ''}`}>
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
  );
}
