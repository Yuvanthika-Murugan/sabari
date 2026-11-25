import { useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import type { Notification } from '@/types';

export const notificationColors: Record<Notification['type'], string> = {
  due_today: 'bg-warning-100 text-warning-600',
  overdue: 'bg-danger-100 text-danger-600',
  payment_submitted: 'bg-blue-100 text-blue-600',
  manager_approval: 'bg-primary-100 text-primary-600',
  md_approval: 'bg-gold-100 text-gold-700',
  payment_approved: 'bg-success-100 text-success-600',
  payment_rejected: 'bg-danger-100 text-danger-600',
  transfer: 'bg-primary-100 text-primary-600',
  day_end: 'bg-warning-100 text-warning-600',
};

export function useNotificationActions() {
  const { run } = useAction();
  return {
    markRead: (id: string) => run(() => api.post(`/notifications/${id}/read`)),
    markAllRead: () => run(() => api.post('/notifications/read-all')),
    remove: (id: string) => run(() => api.delete(`/notifications/${id}`)),
  };
}
