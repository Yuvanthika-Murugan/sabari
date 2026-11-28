import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Input, Select, TextArea, PhoneInput } from '@/components/FormControls';
import { checks } from '@/lib/validation';
import { useApp } from '@/context/AppContext';
import { useData } from '@/context/DataContext';
import { useForm } from '@/hooks/useForm';
import PhotoInput, { Avatar } from '@/components/PhotoInput';import { api } from '@/lib/api';
import type { CompanySettings, User } from '@/types';
import {
  Building, User as UserIcon, Bell, Shield, KeyRound, Landmark, MapPin, Receipt, CalendarRange,
  Users, Building2, UsersRound, UserCircle, CheckCircle2, ChevronRight, Lock, BadgePercent, LogIn, ScrollText,
} from 'lucide-react';

type Tab = 'company' | 'profile' | 'security' | 'system';

const roleLabel: Record<string, string> = { md: 'Managing Director', admin: 'Admin', manager: 'Manager', staff: 'Collection Staff' };

/** A titled section of the active tab, with an optional footer for actions. */
function Panel({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-card border border-gray-100">
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="p-6">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 bg-gray-50/70 border-t border-gray-100 rounded-b-xl">{footer}</div>}
    </div>
  );
}

function SaveBar({ dirty, saving, onSave, onReset, label }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void; label: string }) {
  return (
    <>
      <span className={`text-xs mr-auto ${dirty ? 'text-warning-700' : 'text-gray-400'}`}>{dirty ? 'You have unsaved changes' : 'All changes saved'}</span>
      <button onClick={onReset} disabled={!dirty || saving} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-lg hover:bg-gray-50 disabled:opacity-40">Discard</button>
      <button onClick={onSave} disabled={!dirty || saving} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-40 flex items-center gap-2">
        {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {label}
      </button>
    </>
  );
}

/** Rough strength score (0–4) for the new-password meter. */
function strength(pw: string) {
  if (!pw) return 0;
  let score = pw.length >= 6 ? 1 : 0;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

function StatusRow({ icon, title, detail, to }: { icon: ReactNode; title: string; detail: string; to?: string }) {
  const body = (
    <>
      <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-primary-600 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{detail}</p>
      </div>
      <span className="flex items-center gap-1 text-xs font-medium text-success-700 bg-success-50 px-2 py-1 rounded-full flex-shrink-0"><CheckCircle2 className="w-3.5 h-3.5" /> On</span>
      {to && <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-600 flex-shrink-0" />}
    </>
  );
  return to
    ? <Link to={to} className="group flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-primary-50/60 transition-colors">{body}</Link>
    : <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">{body}</div>;
}

export default function Settings() {
  const { currentUser, setCurrentUser } = useApp();
  const { settings, commission, branches, users, customers, groups, auditLogs } = useData();
  const isAdmin = currentUser?.role === 'md' || currentUser?.role === 'admin';
  const location = useLocation();
  // Links can open a specific tab, e.g. navigate('/settings', { state: { tab: 'profile' } }).
  const requestedTab = (location.state as { tab?: Tab } | null)?.tab;
  const [tab, setTab] = useState<Tab>(requestedTab ?? (isAdmin ? 'company' : 'profile'));
  useEffect(() => { if (requestedTab) setTab(requestedTab); }, [requestedTab, location.key]);

  // photoData: a newly chosen photo (data URL); removePhoto: '1' to clear the saved one.
  const profileDefaults = { name: currentUser?.name ?? '', email: currentUser?.email ?? '', phone: currentUser?.phone ?? '', photoData: '', removePhoto: '' };
  const profile = useForm(profileDefaults);
  const company = useForm({ ...settings });
  const password = useForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const dirty = <T extends Record<string, string>>(values: T, base: T) => Object.keys(base).some(k => values[k] !== base[k]);
  const profileDirty = dirty(profile.values, profileDefaults);
  const companyDirty = dirty(company.values, { ...settings });

  const saveProfile = async () => {
    let saved: User | null = null;
    const ok = await profile.submit(async v => { saved = await api.put<User>('/profile', v); setCurrentUser(saved); }, 'Profile updated');
    // Clear the pending photo so the form is no longer "dirty".
    if (ok && saved) {
      const u: User = saved;
      profile.reset({ name: u.name, email: u.email, phone: u.phone, photoData: '', removePhoto: '' });
    }
  };
  const saveCompany = () => company.submit(v => api.put<CompanySettings>('/settings', v), 'Company settings saved');
  const savePassword = async () => {
    if (await password.submit(v => api.put('/profile/password', v), 'Password changed. Other devices have been signed out.')) password.reset();
  };

  const branch = branches.find(b => b.id === currentUser?.branchId);
  const lastLogin = auditLogs.find(a => a.module === 'Login' && a.action === 'Login' && a.user === currentUser?.name);
  const pwScore = strength(password.values.newPassword);
  const pwMeter = [
    { label: 'Too short', color: 'bg-danger-500' }, { label: 'Weak', color: 'bg-danger-500' }, { label: 'Fair', color: 'bg-warning-500' },
    { label: 'Good', color: 'bg-success-500' }, { label: 'Strong', color: 'bg-success-600' },
  ][pwScore];

  const tabs: { id: Tab; label: string; icon: typeof Building }[] = [
    { id: 'company', label: 'Company', icon: Building },
    { id: 'profile', label: 'My Profile', icon: UserIcon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'system', label: 'System', icon: Bell },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader title="Company Profile" subtitle="Company details, your account and system preferences" />

      {/* Company header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 text-white shadow-cardLg mb-6">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-gold-500/10" />
        <div className="absolute right-24 -bottom-20 w-48 h-48 rounded-full bg-gold-500/5" />
        <div className="relative p-6 flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow flex-shrink-0">
              <Landmark className="w-8 h-8 text-primary-950" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{settings.companyName || 'Your company'}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-primary-100">
                {settings.gstNumber && <span className="flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> GST {settings.gstNumber}</span>}
                <span className="flex items-center gap-1.5"><CalendarRange className="w-3.5 h-3.5" /> FY starts {settings.fyStart === 'jan' ? 'January' : 'April'}</span>
                {settings.companyAddress && <span className="flex items-center gap-1.5 min-w-0"><MapPin className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{settings.companyAddress}</span></span>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 lg:w-[420px]">
            {[
              { label: 'Branches', value: branches.length, icon: Building2 },
              { label: 'Users', value: users.length, icon: Users },
              { label: 'Groups', value: groups.length, icon: UsersRound },
              { label: 'Customers', value: customers.length, icon: UserCircle },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-white/10 backdrop-blur-sm px-3 py-2.5 text-center">
                <s.icon className="w-4 h-4 mx-auto text-gold-400" />
                <p className="text-lg font-bold mt-1">{s.value}</p>
                <p className="text-[11px] text-primary-100">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 items-start">
        {/* Tabs + account card */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <nav className="bg-white rounded-xl shadow-card border border-gray-100 p-2 flex lg:flex-col gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-colors ${tab === t.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                <t.icon className="w-4 h-4" />
                <span className="flex-1 text-left">{t.label}</span>
                {t.id === 'company' && companyDirty && <span className="w-2 h-2 rounded-full bg-warning-500" title="Unsaved changes" />}
                {t.id === 'profile' && profileDirty && <span className="w-2 h-2 rounded-full bg-warning-500" title="Unsaved changes" />}
              </button>
            ))}
          </nav>

          <div className="hidden lg:block bg-white rounded-xl shadow-card border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={currentUser?.name ?? 'User'} photo={currentUser?.photo} className="w-11 h-11 bg-gold-500 text-primary-950" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{currentUser?.name}</p>
                <p className="text-xs text-gray-500">{roleLabel[currentUser?.role ?? ''] ?? ''}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-gray-500">Employee ID</dt><dd className="font-mono text-gray-700">{currentUser?.empId}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Branch</dt><dd className="text-gray-700">{branch?.name ?? '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Joined</dt><dd className="text-gray-700">{currentUser?.joiningDate || '-'}</dd></div>
              {lastLogin && <div className="flex justify-between"><dt className="text-gray-500">Last sign-in</dt><dd className="text-gray-700">{lastLogin.date} {lastLogin.time}</dd></div>}
            </dl>
          </div>
        </div>

        {/* Active tab */}
        <div className="space-y-6 min-w-0">
          {tab === 'company' && (
            <Panel title="Company details" description="Shown on reports and printed statements."
              footer={isAdmin
                ? <SaveBar dirty={companyDirty} saving={company.submitting} onSave={saveCompany} onReset={() => company.reset({ ...settings })} label="Save Company Details" />
                : <span className="flex items-center gap-2 text-xs text-gray-500 mr-auto"><Lock className="w-3.5 h-3.5" /> Only the MD or an Admin can change company details.</span>}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Company Name" {...company.field('companyName')} required disabled={!isAdmin} className="md:col-span-2" />
                <Input label="GST Number" format="upper" maxLength={15} check={checks.gst} {...company.field('gstNumber')} placeholder="33ABCDE1234F1Z5" disabled={!isAdmin} />
                <Select label="Currency" {...company.field('currency')} options={[{ value: 'inr', label: 'Indian Rupee (₹)' }]} disabled={!isAdmin} />
                <Select label="Financial Year Start" {...company.field('fyStart')} options={[{ value: 'apr', label: 'April' }, { value: 'jan', label: 'January' }]} disabled={!isAdmin} />
                <div />
                <TextArea label="Registered Address" {...company.field('companyAddress')} placeholder="Registered address" disabled={!isAdmin} className="md:col-span-2" />
                <Input label="UPI ID" maxLength={100} {...company.field('upiId')} placeholder="sabarithendral@okaxis" disabled={!isAdmin} />
                <Input label="UPI Payee Name" maxLength={100} {...company.field('upiPayeeName')} placeholder="Sabari Thendral Chits" disabled={!isAdmin} />
                <p className="md:col-span-2 text-xs text-gray-500">Collection staff show a payment QR for this UPI ID, filled with the amount being collected.</p>
              </div>
            </Panel>
          )}

          {tab === 'profile' && (
            <Panel title="My profile" description="Your name, email and phone. Your email is also your sign-in ID."
              footer={<SaveBar dirty={profileDirty} saving={profile.submitting} onSave={saveProfile} onReset={() => profile.reset(profileDefaults)} label="Save Profile" />}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-5 border-b border-gray-100">
                <PhotoInput
                  current={currentUser?.photo ?? null}
                  value={profile.values.photoData}
                  removed={profile.values.removePhoto === '1'}
                  onChange={dataUrl => { profile.set('photoData', dataUrl); profile.set('removePhoto', ''); }}
                  onRemove={() => { profile.set('photoData', ''); profile.set('removePhoto', currentUser?.photo ? '1' : ''); }}
                  error={profile.errors.photo}
                />
                <div className="sm:text-right">
                  <p className="text-base font-semibold text-gray-900">{profile.values.name || '—'}</p>
                  <p className="text-sm text-gray-500">{roleLabel[currentUser?.role ?? '']} · {branch?.name ?? 'No branch'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Full Name" format="name" check={checks.name} maxLength={120} {...profile.field('name')} required className="md:col-span-2" />
                <Input label="Email" type="email" {...profile.field('email')} required />
                <PhoneInput label="Phone" {...profile.field('phone')} required />
              </div>
              <p className="text-xs text-gray-400 mt-4">Role, branch and employee ID are managed by an administrator in Users.</p>
            </Panel>
          )}

          {tab === 'security' && (
            <>
              <Panel title="Change password" description="You'll stay signed in here; your other devices will be signed out."
                footer={<button onClick={savePassword} disabled={password.submitting} className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-60 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Change Password</button>}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Current Password" type="password" {...password.field('currentPassword')} required className="md:col-span-2" />
                  <div>
                    <Input label="New Password" type="password" {...password.field('newPassword')} placeholder="8+ characters, letters and numbers" required />
                    {password.values.newPassword && (
                      <div className="mt-2">
                        <div className="flex gap-1">{[1, 2, 3, 4].map(i => <div key={i} className={`h-1 flex-1 rounded-full ${i <= pwScore ? pwMeter.color : 'bg-gray-200'}`} />)}</div>
                        <p className="text-xs text-gray-500 mt-1">{pwMeter.label}</p>
                      </div>
                    )}
                  </div>
                  <Input label="Confirm New Password" type="password" {...password.field('confirmPassword')} required />
                </div>
                <p className="text-xs text-gray-400 mt-4">Use 10+ characters with upper and lower case, a number and a symbol for a strong password.</p>
              </Panel>

              <Panel title="Account protection" description="Safeguards that are always on for every user.">
                <div className="space-y-2">
                  <StatusRow icon={<LogIn className="w-4 h-4" />} title="Login history" detail="Sign-ins, sign-outs, failed attempts and password changes are recorded" to={isAdmin ? '/company/logins' : undefined} />
                  <StatusRow icon={<ScrollText className="w-4 h-4" />} title="Audit logging" detail="Every financial change is recorded with user, old and new value" to={isAdmin ? '/audit' : undefined} />
                  <StatusRow icon={<Shield className="w-4 h-4" />} title="Session expiry" detail="Every sign-in expires automatically after a set number of hours (12 by default)" />
                </div>
              </Panel>
            </>
          )}

          {tab === 'system' && (
            <>
              <Panel title="Approvals & controls" description="Business rules the system enforces.">
                <div className="space-y-2">
                  <StatusRow icon={<CheckCircle2 className="w-4 h-4" />} title="MD approval for payments" detail="Every payment needs manager acceptance, then MD approval" to="/payments/approval" />
                  <StatusRow icon={<CheckCircle2 className="w-4 h-4" />} title="Voucher approval" detail="Manager vouchers wait for MD or Admin approval" to="/payments/voucher" />
                  <StatusRow icon={<Lock className="w-4 h-4" />} title="Day end lock" detail="No new entries for a closed day" to={isAdmin ? '/day-end' : undefined} />
                  <StatusRow icon={<BadgePercent className="w-4 h-4" />} title="Auction & commission rules"
                    detail={`Foreman ${commission.foremanCommissionPct}% · max bid ${commission.maxBidPct}% · agent ${commission.agentCommissionPct}%`}
                    to={currentUser?.role !== 'staff' ? '/setup/commission' : undefined} />
                </div>
              </Panel>

              <Panel title="Notifications" description="These events create in-app notifications for all users.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {['Payment submitted', 'Manager acceptance (MD approval required)', 'Payment approved', 'Payment rejected', 'Auction held', 'Customer transfers'].map(item => (
                    <div key={item} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50">
                      <span className="text-sm text-gray-700">{item}</span>
                      <span className="text-xs font-medium text-success-700 bg-success-50 px-2 py-0.5 rounded-full">On</span>
                    </div>
                  ))}
                </div>
                <Link to="/notifications" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-4">Open notifications <ChevronRight className="w-4 h-4" /></Link>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
