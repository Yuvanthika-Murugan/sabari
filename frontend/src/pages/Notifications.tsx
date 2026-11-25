import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import DataTable from '@/components/DataTable';
import { useData } from '@/context/DataContext';
import { notificationColors, useNotificationActions } from '@/hooks/useNotifications';
import type { Notification } from '@/types';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';

export default function Notifications() {
  const { notifications } = useData();
  const { markRead, markAllRead, remove } = useNotificationActions();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  const columns = [
    { key: 'type', label: 'Type', render: (n: Notification) => (
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${notificationColors[n.type] ?? 'bg-gray-100 text-gray-600'}`}><Bell className="w-4 h-4" /></div>
    )},
    { key: 'title', label: 'Title', sortable: true, render: (n: Notification) => (
      <div><p className={`text-sm ${!n.read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p><p className="text-xs text-gray-500">{n.message}</p></div>
    )},
    { key: 'time', label: 'Time', sortable: true, render: (n: Notification) => <span className="text-xs text-gray-500">{n.time}</span> },
    { key: 'read', label: 'Status', render: (n: Notification) => n.read ? <span className="text-xs text-gray-400">Read</span> : <span className="text-xs font-medium text-primary-600">Unread</span> },
    { key: 'actions', label: 'Actions', render: (n: Notification) => (
      <div className="flex gap-1">
        {!n.read && <button onClick={() => markRead(n.id)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600" title="Mark Read"><Check className="w-4 h-4" /></button>}
        <button onClick={() => remove(n.id)} className="p-1.5 rounded-lg hover:bg-danger-50 text-danger-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread notifications`} actions={
        <>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === 'all' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>All</button>
            <button onClick={() => setFilter('unread')} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === 'unread' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>Unread ({unreadCount})</button>
          </div>
          <button onClick={markAllRead} disabled={!unreadCount} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-40"><CheckCheck className="w-4 h-4" /> Mark All Read</button>
        </>
      } />
      <DataTable columns={columns} data={filtered} searchable={false} pageSize={15} emptyMessage="No notifications" />
    </div>
  );
}
