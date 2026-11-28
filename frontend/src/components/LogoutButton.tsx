import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Modal from '@/components/Modal';
import { useApp } from '@/context/AppContext';

/**
 * The one Logout button used in every panel (Super Admin, Admin, collection app).
 * Always red and labelled "Logout" so it stands apart from the other header buttons,
 * and it asks before signing out so a stray tap does not end the session.
 * tone="dark" for dark headers, "light" for white ones.
 */
export default function LogoutButton({ tone = 'light', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  const { logout } = useApp();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const signOut = () => { setConfirm(false); logout(); navigate('/login', { replace: true }); };

  const style = tone === 'dark'
    ? 'bg-danger-600 text-white border-danger-500 hover:bg-danger-700 shadow-sm'
    : 'bg-danger-50 text-danger-700 border-danger-200 hover:bg-danger-100';

  return (
    <>
      <button type="button" onClick={() => setConfirm(true)} title="Logout" aria-label="Logout"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-400 ${style}`}>
        <LogOut className="w-4 h-4" />
        <span className={compact ? 'hidden sm:inline' : ''}>Logout</span>
      </button>

      <Modal isOpen={confirm} onClose={() => setConfirm(false)} title="Logout?" size="sm"
        footer={
          <>
            <button onClick={() => setConfirm(false)} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={signOut} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-danger-600 rounded-lg hover:bg-danger-700">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </>
        }>
        <p className="text-sm text-gray-600">You will be signed out of this device and taken back to the sign-in page.</p>
      </Modal>
    </>
  );
}
