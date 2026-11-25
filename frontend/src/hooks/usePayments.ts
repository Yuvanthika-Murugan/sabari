import { useAction } from '@/hooks/useForm';
import { api } from '@/lib/api';
import type { PaymentApproval, Role } from '@/types';

export type PaymentAction = 'approve' | 'reject' | 'send_back';

/** Whether a user with this role can act on a payment at its current stage (mirrors the API). */
export function canActOnPayment(role: Role | undefined, stage: PaymentApproval['currentStage']) {
  if (stage === 'payment_informed') return role === 'manager' || role === 'admin' || role === 'md';
  if (stage === 'manager_accepted' || stage === 'md_approved') return role === 'md';
  return false;
}

const actionMessages: Record<PaymentAction, string> = {
  approve: 'Payment approved',
  reject: 'Payment rejected',
  send_back: 'Payment sent back',
};

export function usePaymentActions() {
  const { run, busy } = useAction();
  const act = (p: PaymentApproval, action: PaymentAction) =>
    run(() => api.post(`/payments/${p.id}/action`, { action }), actionMessages[action]);
  return { act, busy };
}
