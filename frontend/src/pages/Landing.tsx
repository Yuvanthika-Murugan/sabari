import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark, ArrowRight, Menu, X, Users, Wallet, Gavel, TrendingDown, ShieldCheck, Receipt,
  Bike, CalendarDays, MapPin, Phone, LogIn, CheckCircle2, ChevronDown, Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { BRAND, HERO_IMAGE as heroImage } from '@/lib/brand';

/** What GET /api/public/info returns (no sign-in needed). */
interface PublicInfo {
  companyName: string;
  companyAddress: string;
  gstNumber: string;
  branches: { name: string; address: string; phone: string }[];
}

const sections = [
  { id: 'about', label: 'About' },
  { id: 'how', label: 'How it works' },
  { id: 'schemes', label: 'Schemes' },
  { id: 'contact', label: 'Contact' },
];

const reasons = [
  { icon: Gavel, title: 'Open auctions', text: 'Every instalment has an auction. The bid, commission and dividend are recorded and shared with all members.' },
  { icon: TrendingDown, title: 'Dividend every auction', text: 'The discount from each auction is shared among members, so your instalments come down as the group runs.' },
  { icon: Receipt, title: 'A receipt for every payment', text: 'Each payment gets a numbered receipt, and your full payment history is kept on record.' },
  { icon: Bike, title: 'Doorstep collection', text: 'Our collection staff visit your area on schedule, so you can pay without leaving home.' },
  { icon: ShieldCheck, title: 'Checked at every step', text: 'Bank and UPI payments are verified by a manager and approved by the Managing Director.' },
  { icon: Wallet, title: 'Save and borrow in one', text: 'Build savings with fixed instalments, and take the chit amount early through the auction when you need it.' },
];

const steps = [
  { title: 'Join a group', text: 'Choose a chit group that suits your budget and enrol at any branch.' },
  { title: 'Pay your instalment', text: 'Pay at the branch, to our collection staff, or by bank / UPI.' },
  { title: 'Bid in the auction', text: 'Need money early? The member offering the highest discount wins the chit amount.' },
  { title: 'Earn the dividend', text: 'The discount is shared among all members, reducing everyone\'s next instalments.' },
];

const schemes = [
  { title: 'Monthly', text: 'One instalment and one auction a month. Our most popular plan.', tag: 'Popular' },
  { title: 'Bi-monthly', text: 'Instalments two months apart, for seasonal or larger incomes.' },
  { title: 'Weekly', text: 'Small weekly instalments, ideal for shop owners and daily earners.' },
  { title: 'Daily', text: 'Tiny daily amounts, collected at your doorstep by our staff.' },
];

/**
 * Dummy figures for the hero illustration only. This is NOT data from the
 * database and must never show a real group or customer.
 */
const SAMPLE_GROUP = {
  value: '₹1,00,000',
  members: 20,
  instalments: 20,
  instalment: '₹5,000',
  paid: 8,
  // Each member's payment (% of the full instalment) after the month's dividend.
  payments: [100, 92, 88, 85, 90, 82, 80, 78],
};

/** Glides to a section without putting "#section" in the address bar. */
const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Public home page shown to visitors before they sign in. */
export default function Landing() {
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState('');

  useEffect(() => {
    api.get<PublicInfo>('/public/info').then(setInfo).catch(() => { /* page works without it */ });
  }, []);

  // Solid top bar after leaving the hero, and the reading-progress bar.
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(window.scrollY > 40);
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Highlight the menu item of the section in view.
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    ['top', ...sections.map(s => s.id)].forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  // Phone menu: close it as soon as the page scrolls, on Esc, or when the screen
  // widens to the desktop menu. A 10px allowance ignores a finger's small jitter.
  useEffect(() => {
    if (!menuOpen) return;
    const startY = window.scrollY;
    const close = () => setMenuOpen(false);
    const onScroll = () => { if (Math.abs(window.scrollY - startY) > 10) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onResize = () => { if (window.innerWidth >= 768) close(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  const go = (id: string) => { setMenuOpen(false); scrollToId(id); };
  const name = info?.companyName || BRAND.name;
  const branches = info?.branches ?? [];
  const firstPhone = branches.find(b => b.phone)?.phone;

  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* ---------- Scroll progress ---------- */}
      <div className="fixed top-0 left-0 z-50 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600 transition-[width] duration-150" style={{ width: `${progress}%` }} />

      {/* Dimmed backdrop behind the open phone menu; tapping it closes the menu. */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-primary-950/40 backdrop-blur-[2px] md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      {/* ---------- Top bar: transparent over the hero, solid once scrolled ---------- */}
      <header className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${scrolled || menuOpen ? 'bg-primary-950/95 backdrop-blur shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          <button type="button" onClick={() => go('top')} className="flex items-center gap-3 min-w-0 text-left">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow flex-shrink-0">
              <Landmark className="w-6 h-6 text-primary-950" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[13px] font-bold text-white whitespace-nowrap">{BRAND.line1}</p>
              <p className="text-[13px] font-bold text-gold-400 whitespace-nowrap">{BRAND.line2}</p>
            </div>
          </button>
          <nav className="hidden md:flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
            {sections.map(s => (
              <button key={s.id} type="button" onClick={() => go(s.id)}
                className={`px-4 py-1.5 rounded-full text-sm transition-colors ${active === s.id ? 'bg-gold-500 text-primary-950 font-semibold' : 'text-gray-200 hover:text-white hover:bg-white/10'}`}>
                {s.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-primary-950 text-sm font-semibold hover:bg-gold-400 transition-colors">
              <LogIn className="w-4 h-4" /> Login
            </Link>
            <button type="button" onClick={() => setMenuOpen(o => !o)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}
              className="md:hidden p-2 rounded-lg text-white hover:bg-white/10">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 px-4 pb-4 pt-2 space-y-1">
            {sections.map(s => (
              <button key={s.id} type="button" onClick={() => go(s.id)}
                className={`block w-full text-left px-3 py-2.5 rounded-lg ${active === s.id ? 'bg-white/10 text-gold-400' : 'text-gray-200 hover:bg-white/10'}`}>{s.label}</button>
            ))}
            <Link to="/login" className="flex items-center justify-center gap-2 mt-2 px-4 py-2.5 rounded-lg bg-gold-500 text-primary-950 text-sm font-semibold">
              <LogIn className="w-4 h-4" /> Login
            </Link>
          </div>
        )}
      </header>

      {/* ---------- Hero: exactly one screen tall ---------- */}
      {/* At least one screen tall; grows on small/short screens instead of squeezing the content. */}
      <section id="top" className="relative min-h-[100svh] flex items-center overflow-hidden bg-primary-950">
        <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-950 via-primary-950/85 to-primary-900/40" />
        <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-gold-500/10 blur-3xl" />

        {/* pt clears the fixed top bar; pb leaves room for the SCROLL cue so they never overlap. */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 w-full pt-24 pb-24 sm:pt-28 lg:pt-24 lg:pb-20 grid lg:grid-cols-[1.15fr_1fr] gap-10 items-center">
          <div className="animate-hero">
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/15 border border-gold-400/30 text-gold-300 text-xs font-medium mb-5">
              <MapPin className="w-3.5 h-3.5" /> {branches.length ? `Serving ${branches.map(b => b.name).join(', ')}` : 'Your trusted chit fund partner'}
            </p>
            <h1 className="font-serif text-[2.1rem] min-[380px]:text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1]">
              Save together.<br /><span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">Grow together.</span>
            </h1>
            <p className="mt-5 text-[15px] min-[380px]:text-base sm:text-lg text-gray-300 leading-relaxed max-w-xl">
              {name} runs chit groups that help families and businesses save in small, regular instalments
              and get a lump sum when they need it, with open auctions and a receipt for every rupee.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => go('contact')} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gold-500 text-primary-950 font-semibold hover:bg-gold-400 shadow-glow transition-colors">
                Join a chit group <ArrowRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => go('how')} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/25 text-white font-semibold hover:bg-white/10 transition-colors">
                How it works
              </button>
            </div>
            {firstPhone && (
              <a href={`tel:${firstPhone}`} className="mt-6 inline-flex items-center gap-2 text-sm text-gray-300 hover:text-gold-300">
                <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><Phone className="w-4 h-4 text-gold-400" /></span>
                Call us <span className="font-semibold text-white">{firstPhone}</span>
              </a>
            )}
          </div>

          {/* Illustration of how a chit group runs. Dummy figures only (SAMPLE_GROUP), never real data. */}
          <div className="hidden lg:block animate-hero-delay">
            <div className="relative rounded-2xl bg-white/[0.07] border border-white/15 backdrop-blur-md p-6 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-gray-300">Example chit group</p>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/15">Sample</span>
              </div>
              <p className="mt-3 text-3xl font-bold">{SAMPLE_GROUP.value}</p>
              <p className="text-sm text-gray-300">{SAMPLE_GROUP.members} members · {SAMPLE_GROUP.instalments} monthly instalments</p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                {[['Instalment', SAMPLE_GROUP.instalment], ['Auction', 'Monthly'], ['Dividend', 'Shared']].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-white/5 border border-white/10 py-3">
                    <p className="text-[11px] text-gray-400">{k}</p>
                    <p className="text-sm font-semibold mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <div className="flex justify-between text-xs text-gray-300 mb-1.5"><span>Example progress</span><span>{SAMPLE_GROUP.paid} of {SAMPLE_GROUP.instalments}</span></div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600" style={{ width: `${(SAMPLE_GROUP.paid / SAMPLE_GROUP.instalments) * 100}%` }} />
                </div>
              </div>
              <div className="mt-5 flex items-end gap-1.5 h-16" aria-hidden="true">
                {SAMPLE_GROUP.payments.map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary-500/60 to-primary-300/80" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-gray-400">Each bar is a member's payment after that month's dividend: it comes down as the group runs.</p>
              {/* <p className="mt-3 pt-3 border-t border-white/10 text-[11px] text-gold-300/90">Dummy figures for illustration only. This is not a real group.</p> */}
              <div className="absolute -top-4 -left-4 flex items-center gap-2 rounded-full bg-gold-500 text-primary-950 px-3 py-1.5 text-xs font-semibold shadow-lg">
                <Sparkles className="w-3.5 h-3.5" /> Dummy data
              </div>
            </div>
          </div>
        </div>

        <button type="button" onClick={() => go('about')} aria-label="Scroll down"
          className="absolute bottom-5 sm:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-gray-300 hover:text-gold-400 transition-colors">
          <span className="text-[11px] tracking-widest uppercase">Scroll</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </button>
      </section>

      {/* ---------- About / why us ---------- */}
      <section id="about" className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal><SectionTitle eyebrow="Why choose us" title="A chit fund you can trust"
            text="A chit fund is a group savings plan: members pay a fixed instalment, and each period one member receives the pooled amount through an auction." /></Reveal>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reasons.map((r, i) => (
              <Reveal key={r.title} delay={(i % 3) * 90}>
                <div className="group h-full bg-white rounded-2xl p-6 border border-gray-100 shadow-card hover:shadow-cardLg hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary-950 text-gold-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform"><r.icon className="w-5 h-5" /></div>
                  <h3 className="font-semibold text-gray-900">{r.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{r.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works: timeline ---------- */}
      <section id="how" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal><SectionTitle eyebrow="How it works" title="Four simple steps" center /></Reveal>
          <div className="relative mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-6" role="list">
            <div className="hidden lg:block absolute top-6 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-gold-200 via-gold-400 to-gold-200" aria-hidden="true" />
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 120}>
                <div className="relative text-center" role="listitem">
                  <div className="relative mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-primary-950 font-bold text-lg flex items-center justify-center shadow-glow ring-8 ring-white">{i + 1}</div>
                  <h3 className="mt-5 font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-[16rem] mx-auto">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="mt-14 rounded-2xl bg-gradient-to-r from-primary-50 to-gold-50 border border-primary-100 p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-card flex-shrink-0"><Users className="w-6 h-6 text-primary-600" /></div>
              <p className="text-sm text-primary-900 leading-relaxed">
                <span className="font-semibold">Example:</span> in a ₹1,00,000 group with 20 members, each member pays ₹5,000 per instalment.
                If a member wins an auction with a ₹10,000 discount, they receive the chit amount minus that discount, and after the foreman's
                commission the rest of the discount is shared as a dividend that lowers every member's next payment.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Schemes ---------- */}
      <section id="schemes" className="relative py-20 sm:py-28 bg-primary-950 text-white overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-700/30 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal><SectionTitle dark eyebrow="Schemes" title="Pay the way that suits you"
            text="Groups come in different values and durations. Pick how often you want to pay." /></Reveal>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {schemes.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="relative h-full rounded-2xl p-6 bg-white/[0.04] border border-white/10 hover:border-gold-400/60 hover:bg-white/[0.07] transition-all duration-300">
                  {s.tag && <span className="absolute top-4 right-4 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold-500 text-primary-950 font-bold">{s.tag}</span>}
                  <CalendarDays className="w-7 h-7 text-gold-400" />
                  <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-300 leading-relaxed">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <ul className="mt-10 flex flex-wrap gap-3 text-sm text-gray-200">
              {['Pay by cash, UPI, bank transfer or cheque', 'Numbered receipt for every payment', 'Nominee for every subscriber'].map(t => (
                <li key={t} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10"><CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" /> {t}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ---------- Contact / branches ---------- */}
      <section id="contact" className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal><SectionTitle eyebrow="Visit us" title="Our branches"
            text="Walk in to any branch to join a group, ask about a scheme, or pay your instalment." /></Reveal>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {branches.map((b, i) => (
              <Reveal key={b.name} delay={i * 90}>
                <div className="h-full bg-white rounded-2xl p-6 border border-gray-100 shadow-card hover:shadow-cardLg transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gold-50 text-gold-600 flex items-center justify-center"><Landmark className="w-5 h-5" /></div>
                    <h3 className="font-semibold text-gray-900">{b.name} Branch</h3>
                  </div>
                  {b.address && <p className="mt-4 text-sm text-gray-600 flex gap-2"><MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /> {b.address}</p>}
                  {b.phone && <a href={`tel:${b.phone}`} className="mt-2 text-sm text-primary-700 font-medium flex items-center gap-2 hover:underline"><Phone className="w-4 h-4 text-gray-400" /> {b.phone}</a>}
                </div>
              </Reveal>
            ))}
            {branches.length === 0 && <p className="text-sm text-gray-500 sm:col-span-2 lg:col-span-3">Branch details will appear here.</p>}
          </div>
          {info?.companyAddress && (
            <p className="mt-8 text-sm text-gray-600 flex gap-2"><MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /> Registered office: {info.companyAddress}</p>
          )}

          <Reveal>
            <div className="mt-16 rounded-3xl bg-gradient-to-br from-primary-900 to-primary-950 p-8 sm:p-12 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute -right-16 -bottom-24 w-72 h-72 rounded-full bg-gold-500/15 blur-2xl" aria-hidden="true" />
              <div className="relative">
                <h3 className="font-serif text-2xl sm:text-3xl font-bold">Ready to start saving?</h3>
                <p className="mt-2 text-gray-300">Visit your nearest branch{firstPhone ? ' or give us a call' : ''}. We'll help you pick the right group.</p>
              </div>
              {firstPhone && (
                <a href={`tel:${firstPhone}`} className="relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gold-500 text-primary-950 font-semibold hover:bg-gold-400 shadow-glow transition-colors flex-shrink-0">
                  <Phone className="w-4 h-4" /> {firstPhone}
                </a>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="bg-primary-950 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-center sm:text-left">© {new Date().getFullYear()} {name}. All rights reserved.{info?.gstNumber && <> · GSTIN {info.gstNumber}</>}</p>
          <Link to="/login" className="inline-flex items-center gap-1.5 text-gold-400 hover:text-gold-300 font-medium">
            <LogIn className="w-4 h-4" /> Login
          </Link>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title, text, dark, center }: { eyebrow: string; title: string; text?: string; dark?: boolean; center?: boolean }) {
  return (
    <div className={`max-w-2xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold-500">
        <span className="w-6 h-px bg-gold-500" /> {eyebrow}
      </p>
      <h2 className={`mt-3 font-serif text-3xl sm:text-4xl font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
      {text && <p className={`mt-4 leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{text}</p>}
    </div>
  );
}

/** Fades and lifts its content into place the first time it scrolls into view. */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`h-full transition-all duration-700 ease-out ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      {children}
    </div>
  );
}
