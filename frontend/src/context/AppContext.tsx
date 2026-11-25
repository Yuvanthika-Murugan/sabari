import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@/types';
import { api, onUnauthorized, tokenStore } from '@/lib/api';

interface AppContextType {
  currentUser: User | null;
  /** True while a saved session is being restored on page load. */
  restoring: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setCurrentUser: (user: User) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** Phones and tablets: whether the slide-in navigation drawer is open. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(() => !!tokenStore.get());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const clearSession = useCallback(() => {
    tokenStore.set(null);
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    onUnauthorized(clearSession);
    if (!tokenStore.get()) return;
    api.get<User>('/auth/me')
      .then(setCurrentUser)
      .catch(clearSession)
      .finally(() => setRestoring(false));
  }, [clearSession]);

  const login = async (email: string, password: string) => {
    const { token, user } = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    tokenStore.set(token);
    setCurrentUser(user);
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => { /* token is discarded locally either way */ });
    clearSession();
  };

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  return (
    <AppContext.Provider value={{ currentUser, restoring, login, logout, setCurrentUser, sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
