import { CheckCircle2, Lock, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { requestPasswordReset, signIn } from '../lib/auth.ts';
import { Button } from '../components/ui/button.tsx';
import { InputWithIcon } from '../components/ui/input.tsx';

/** Decorative facility pins scattered over the backdrop — purely visual. */
const PINS = [
  { top: '24%', left: '21%', size: 'size-8', tone: 'text-brand-600' },
  { top: '17%', left: '68%', size: 'size-6', tone: 'text-brand-400' },
  { top: '70%', left: '29%', size: 'size-7', tone: 'text-brand-500' },
  { top: '63%', left: '76%', size: 'size-5', tone: 'text-accent-500' },
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-white to-indigo-50 px-4 py-12 lg:justify-end lg:px-20">
      {/* Decorative backdrop — a stylised map of facility checkpoints, purely visual. */}
      <div className="absolute inset-0 hidden lg:block">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-brand-200/50 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 size-[28rem] rounded-full bg-accent-400/15 blur-3xl" />
        <div className="absolute right-1/4 top-0 size-72 rounded-full bg-brand-300/30 blur-3xl" />

        <div className="absolute left-1/3 top-1/2 flex size-72 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-2xl ring-1 ring-black/5 backdrop-blur">
          <ShieldCheck className="size-24 text-brand-200" strokeWidth={1.25} />
        </div>
        {PINS.map((p, i) => (
          <MapPin
            key={i}
            className={`absolute drop-shadow-sm ${p.size} ${p.tone}`}
            style={{ top: p.top, left: p.left }}
            fill="currentColor"
            fillOpacity={0.15}
          />
        ))}

        <div className="absolute left-12 top-12 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-black/5">
            <ShieldCheck className="size-6 text-brand-600" />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">VMS</p>
            <p className="text-sm text-slate-500">Visitor Management System</p>
          </div>
        </div>
      </div>

      {/* Sign-in card */}
      <div className="relative z-10 w-full max-w-sm animate-rise">
        <div className="mb-8 lg:hidden">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[var(--shadow-brand)]">
            <ShieldCheck className="size-6" />
          </span>
        </div>
        <div className="mb-7">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {forgotMode ? 'Reset your password' : 'Sign in'}
          </h1>
          {forgotMode && (
            <p className="mt-1 text-sm text-slate-500">
              Enter your account email and we’ll send you a reset link.
            </p>
          )}
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
  );
}
