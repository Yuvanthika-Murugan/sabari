import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import type { Agent, Customer } from '@/types';

/**
 * For the collection app: which customers belong to the signed-in user. Collection
 * staff own the customers assigned to them; an agent with a login (agents.userId)
 * also owns the customers they introduced.
 */
export function useMyCustomers(): { agent: Agent | undefined; isMine: (c: Customer) => boolean } {
  const { currentUser } = useApp();
  const { agents } = useData();
  const agent = currentUser ? agents.find(a => a.userId === currentUser.id) : undefined;
  const isMine = (c: Customer) => c.staffId === currentUser?.id || (!!agent && c.agentId === agent.id);
  return { agent, isMine };
}
