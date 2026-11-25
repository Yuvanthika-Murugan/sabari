import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AppData } from '@/types';
import { api } from '@/lib/api';
import { Landmark, RefreshCw } from 'lucide-react';

interface DataContextType extends AppData {
  /** Re-fetches everything from the API; call after a successful change. */
  refresh: () => Promise<void>;
}

/** How often app data is re-fetched in the background. */
const REFRESH_MS = 30_000;

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setData(await api.get<AppData>('/bootstrap'));
  }, []);

  const load = useCallback(() => {
    setError(null);
    refresh().catch(e => setError(e.message));
  }, [refresh]);

  useEffect(load, [load]);

  // Keep figures live: re-fetch every 30 s while the tab is visible, and as
  // soon as the user returns to the tab, so changes made by other users (or a
  // new day) show up without a manual reload. Background failures are ignored;
  // the next tick retries.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') refresh().catch(() => {}); };
    const timer = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [refresh]);

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow">
          <Landmark className="w-8 h-8 text-primary-950" />
        </div>
        {error ? (
          <>
            <p className="text-sm text-danger-600 max-w-sm text-center">{error}</p>
            <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </>
        ) : (
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
    );
  }

  return <DataContext.Provider value={{ ...data, refresh }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
