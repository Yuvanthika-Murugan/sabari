import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role, User } from '@/types';
import { api, onUnauthorized, tokenStore } from '@/lib/api';

interface AppContextType {
  currentUser: User | null;
  /** True while a saved session is being restored on page load. */
  restoring: boolean;
  /**
   * The one sign-in for everyone: an email, or the Super Admin Login ID. Resolves with the
   * user and whether it opened a Super Admin (MD) session.
   */
  login: (emailOrLoginId: string, password: string) => Promise<{ user: User; superAdmin: boolean }>;
  logout: () => void;
  /** True when the MD signed in (Super Admin / MD panel session). */
  superAdminSession: boolean;
  /** Leaves the Super Admin Panel (the main-app session stays signed in). */
  exitSuperAdmin: () => void;
  setCurrentUser: (user: User) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** Phones and tablets: whether the slide-in navigation drawer is open. */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const SUPER_ADMIN_KEY = 'fincollect.superAdminSession';

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(() => !!tokenStore.get());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Whether this is the MD's Super Admin (MD panel) session, as reported by the server at sign-in.
  const [superAdminSession, setSuperAdminSessionState] = useState(() => {
    try { return localStorage.getItem(SUPER_ADMIN_KEY) === '1'; } catch { return false; }
  });
  const setSuperAdminSession = useCallback((on: boolean) => {
    try { if (on) localStorage.setItem(SUPER_ADMIN_KEY, '1'); else localStorage.removeItem(SUPER_ADMIN_KEY); } catch { /* storage unavailable */ }
    setSuperAdminSessionState(on);
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.set(null);
    setSuperAdminSession(false);
    setCurrentUser(null);
  }, [setSuperAdminSession]);

  useEffect(() => {
    onUnauthorized(clearSession);
    if (!tokenStore.get()) return;
    api.get<User>('/auth/me')
      .then(setCurrentUser)
      .catch(clearSession)
      .finally(() => setRestoring(false));
  }, [clearSession]);

  const login = async (emailOrLoginId: string, password: string) => {
    const { token, user, superAdmin } = await api.post<{ token: string; user: User; superAdmin?: boolean }>(
      '/auth/login', { email: emailOrLoginId, password });
    tokenStore.set(token);
    // The server says whether this is the MD (Super Admin panel) or anyone else.
    setSuperAdminSession(!!superAdmin);
    setCurrentUser(user);
    return { user, superAdmin: !!superAdmin };
  };

  /** Leaves the Super Admin Panel but keeps the main-app session signed in. */
  const exitSuperAdmin = () => setSuperAdminSession(false);

  const logout = () => {
    api.post('/auth/logout').catch(() => { /* token is discarded locally either way */ });
    clearSession();
  };

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  return (
    <AppContext.Provider value={{ currentUser, restoring, login, logout, setCurrentUser, sidebarCollapsed, toggleSidebar, mobileNavOpen, setMobileNavOpen, superAdminSession, exitSuperAdmin }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
