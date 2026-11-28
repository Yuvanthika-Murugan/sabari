import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Input } from '@/components/FormControls';
import { useForm } from '@/hooks/useForm';
import { api } from '@/lib/api';

interface Credentials { loginId: string; configured: boolean }

/**
 * MD only (Company Profile → Security): sets the Super Admin Panel's own Login ID and
 * password. They are separate from every user's email and password; the MD's current
 * password is required to change them.
 */
export default function SuperAdminCredentials() {
  const [current, setCurrent] = useState<Credentials | null>(null);
  const form = useForm({ loginId: '', newPassword: '', confirmPassword: '', currentPassword: '' });

  useEffect(() => {
    api.get<Credentials>('/super-admin/credentials')
      .then(c => { setCurrent(c); form.reset({ loginId: c.loginId, newPassword: '', confirmPassword: '', currentPassword: '' }); })
      .catch(() => setCurrent({ loginId: '', configured: false }));
    // Load once when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    let saved: Credentials | null = null;
    const ok = await form.submit(async v => { saved = await api.put<Credentials>('/super-admin/credentials', v); }, 'Super Admin login saved');
    if (ok && saved) {
      const c: Credentials = saved;
      setCurrent(c);
      form.reset({ loginId: c.loginId, newPassword: '', confirmPassword: '', currentPassword: '' });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-card border border-gold-200 mb-6">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-gold-600" /> Super Admin login</h3>
          <p className="text-sm text-gray-500 mt-0.5">Optional: a Login ID and password you can type on the sign-in page instead of your email. Keep it different from your own password.</p>
        </div>
        {current && (current.configured
          ? <span className="text-xs font-medium text-success-700 bg-success-50 border border-success-200 rounded-full px-3 py-1">Set · {current.loginId}</span>
          : <span className="text-xs font-medium text-warning-700 bg-warning-50 border border-warning-200 rounded-full px-3 py-1">Not set yet</span>)}
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Super Admin Login ID" {...form.field('loginId')} placeholder="e.g. superadmin" required className="md:col-span-2" />
        <Input label="New Super Admin Password" type="password" {...form.field('newPassword')} placeholder="8+ characters, letters and numbers" required />
        <Input label="Confirm Super Admin Password" type="password" {...form.field('confirmPassword')} required />
        <Input label="Your Current Password (MD)" type="password" {...form.field('currentPassword')} required className="md:col-span-2" />
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
        <button onClick={save} disabled={form.submitting} className="px-4 py-2 bg-gradient-to-r from-gold-400 to-gold-600 text-primary-950 text-sm font-semibold rounded-lg hover:from-gold-300 hover:to-gold-500 disabled:opacity-60 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {current?.configured ? 'Update Super Admin Login' : 'Set Super Admin Login'}
        </button>
      </div>
    </div>
  );
}
