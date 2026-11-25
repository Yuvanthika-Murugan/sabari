import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Landmark, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { BRAND, HERO_IMAGE } from '@/lib/brand';

// One-click demo login. Shown only on the development server (npm run dev):
// a production build (npm run build) leaves it out, so the MD password is never
// published on the live sign-in page.
const showDemoLogin = import.meta.env.DEV;
const demoAccount = { email: 'rajesh@fincol.in', password: 'password', label: 'Managing Director', desc: 'Full system access' };

export default function Login() {
  const navigate = useNavigate();
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] flex flex-col bg-primary-950 overflow-hidden">
      {/* Full-screen background, same look as the landing page hero. */}
      <img src={HERO_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary-950 via-primary-950/90 to-primary-900/70" />
      <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-gold-500/10 blur-3xl" aria-hidden="true" />

      {/* Top bar */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow">
            <Landmark className="w-6 h-6 text-primary-950" />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-bold text-white whitespace-nowrap">{BRAND.line1}</p>
            <p className="text-[13px] font-bold text-gold-400 whitespace-nowrap">{BRAND.line2}</p>
          </div>
        </Link>
        <Link to="/" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/20 text-sm text-gray-200 hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to home</span><span className="sm:hidden">Home</span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-hero">
          {/* Brand panel (laptop and wider) */}
          <div className="hidden lg:flex flex-col justify-between p-10 bg-white/[0.06] backdrop-blur-md text-white">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-400"><span className="w-6 h-px bg-gold-400" /> {BRAND.tagline}</p>
              <h2 className="mt-4 font-serif text-4xl font-bold leading-tight">
                Welcome to<br /><span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">{BRAND.line1}</span>
              </h2>
              <p className="mt-4 text-gray-300 leading-relaxed">
                Manage chit groups, collections, receipts and approvals for every branch, all in one place.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3">
              {[
                'Groups & auctions',
                'Collections & receipts',
                'Payment approvals',
                'Cash, bank & day end',
              ].map(feat => (
                <div key={feat} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-200">
                  <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" /> {feat}
                </div>
              ))}
            </div>
          </div>

          {/* Sign-in form */}
          <div className="bg-white p-6 sm:p-10">
            <div className="mb-7">
              <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center mb-4"><Lock className="w-6 h-6" /></div>
              <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
              <p className="text-sm text-gray-500 mt-1">Use your email and password to open your dashboard.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    className="w-full pl-10 pr-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                    placeholder="you@fincol.in"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-700 to-primary-900 hover:from-primary-600 hover:to-primary-800 text-white font-semibold rounded-xl transition-all disabled:opacity-60 shadow-lg shadow-primary-900/20"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">Forgot your password? Ask an administrator to reset it.</p>

            {showDemoLogin && <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">Demo login</p>
              <button
                type="button"
                onClick={() => { setEmail(demoAccount.email); setPassword(demoAccount.password); setError(null); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
                  email === demoAccount.email ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${email === demoAccount.email ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <Shield className="w-4 h-4" />
                </div>
                <div className="text-left flex-1">
                  <p className={`text-sm font-medium ${email === demoAccount.email ? 'text-primary-700' : 'text-gray-700'}`}>{demoAccount.label}</p>
                  <p className="text-xs text-gray-500">{demoAccount.email} · {demoAccount.desc}</p>
                </div>
                {email === demoAccount.email && <CheckCircle2 className="w-5 h-5 text-primary-600" />}
              </button>
            </div>}
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-5 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
      </footer>
    </div>
  );
}
