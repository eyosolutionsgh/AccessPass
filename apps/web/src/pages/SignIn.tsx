import { CheckCircle2, Lock, Mail, ScanLine, ShieldCheck, UserCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { requestPasswordReset, signIn } from '../lib/auth.ts';
import { Button } from '../components/ui/button.tsx';
import { InputWithIcon } from '../components/ui/input.tsx';

const FEATURES = [
  { icon: ScanLine, title: 'QR & code check-in', desc: 'Self-service kiosk and reception desks.' },
  { icon: UserCheck, title: 'Real-time visibility', desc: 'Know exactly who is on-site, live.' },
  { icon: ShieldCheck, title: 'Security & compliance', desc: 'Watchlist, audit trail and muster.' },
];

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) toast.error(error.message ?? 'Sign in failed');
  }

  async function onForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message ?? 'Could not send reset link');
    setForgotSent(true);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-mesh p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-grid opacity-[0.04]" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <ShieldCheck className="size-6" />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight">VMS</p>
            <p className="text-sm text-white/60">Visitor Management System</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-balance text-3xl font-bold leading-tight tracking-tight">
            Every visit, secured from invitation to check-out.
          </h2>
          <p className="mt-3 text-white/70">
            On-facility visitor management with pre-registration, badges, real-time occupancy and a
            complete compliance audit trail.
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <f.icon className="size-4.5 text-brand-200" />
                </span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-white/60">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          Self-hosted · Air-gap capable · No cloud dependencies
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-slate-100 bg-grid px-4 py-12">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-8 lg:hidden">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[var(--shadow-brand)]">
              <ShieldCheck className="size-6" />
            </span>
          </div>
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              Staff portal
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {forgotMode ? 'Reset your password' : 'Welcome back'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {forgotMode
                ? 'Enter your account email and we’ll send you a reset link.'
                : 'Sign in to access your workspace.'}
            </p>
          </div>

          {forgotMode ? (
            forgotSent ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-lg ring-1 ring-slate-900/[0.02]">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-6" />
                </span>
                <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-900">
                  Check your email
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  If an account exists for {email}, a reset link is on its way.
                </p>
                <Button
                  variant="outline"
                  className="mt-5 w-full"
                  onClick={() => {
                    setForgotMode(false);
                    setForgotSent(false);
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form
                onSubmit={onForgotSubmit}
                className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg ring-1 ring-slate-900/[0.02]"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Email
                  </label>
                  <InputWithIcon
                    icon={<Mail />}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>
                <button
                  type="button"
                  onClick={() => setForgotMode(false)}
                  className="w-full text-center text-sm font-medium text-slate-500 transition-colors hover:text-brand-600"
                >
                  ← Back to sign in
                </button>
              </form>
            )
          ) : (
            <form
              onSubmit={onSubmit}
              className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg ring-1 ring-slate-900/[0.02]"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Email
                </label>
                <InputWithIcon
                  icon={<Mail />}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
                  >
                    Forgot password?
                  </button>
                </div>
                <InputWithIcon
                  icon={<Lock />}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
