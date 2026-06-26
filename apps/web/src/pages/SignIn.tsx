import { CheckCircle2, Lock, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { requestPasswordReset, signIn } from '../lib/auth.ts';
import { Button } from '../components/ui/button.tsx';
import { InputWithIcon } from '../components/ui/input.tsx';

/** Decorative facility checkpoints scattered over the backdrop — purely visual. */
const PINS = [
  { top: '18%', left: '13%', size: 'size-7', tone: 'text-brand-300/70' },
  { top: '26%', left: '85%', size: 'size-5', tone: 'text-accent-400/70' },
  { top: '72%', left: '16%', size: 'size-6', tone: 'text-brand-200/60' },
  { top: '78%', left: '83%', size: 'size-7', tone: 'text-brand-300/60' },
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

  const title = forgotSent
    ? 'Check your email'
    : forgotMode
      ? 'Reset your password'
      : 'Welcome back';
  const subtitle = forgotSent
    ? `If an account exists for ${email}, a secure reset link is on its way.`
    : forgotMode
      ? 'Enter your account email and we’ll send you a secure reset link.'
      : 'Sign in to the Visitor Management System';

  return (
    <div className="bg-mesh relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Immersive decorative backdrop — a stylised map of facility checkpoints, purely visual. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-grid absolute inset-0 opacity-[0.07]" />
        <div className="absolute -left-32 -top-32 size-[34rem] animate-float-slow rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 size-[36rem] animate-float rounded-full bg-accent-500/20 blur-3xl" />
        <div className="absolute right-1/4 top-10 size-72 rounded-full bg-brand-400/20 blur-3xl" />

        {/* Giant faint shield watermark anchoring the security motif behind the card. */}
        <ShieldCheck
          className="absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-1/2 text-white/[0.04]"
          strokeWidth={0.5}
        />
        {PINS.map((p, i) => (
          <MapPin
            key={i}
            className={`absolute drop-shadow-lg ${p.size} ${p.tone}`}
            style={{ top: p.top, left: p.left }}
            fill="currentColor"
            fillOpacity={0.2}
          />
        ))}
      </div>

      {/* Centered sign-in column */}
      <div className="relative z-10 w-full max-w-sm animate-rise">
        {/* Lockup */}
        <div className="mb-7 flex flex-col items-center text-center">
          <span
            className={`flex size-14 items-center justify-center rounded-2xl text-white shadow-[var(--shadow-brand)] ring-1 ring-white/20 ${
              forgotSent
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                : 'bg-gradient-to-br from-brand-500 to-brand-700'
            }`}
          >
            {forgotSent ? <CheckCircle2 className="size-7" /> : <ShieldCheck className="size-7" />}
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-300">{subtitle}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/60 bg-white/95 p-7 shadow-[0_30px_80px_-24px_oklch(0.272_0.09_270/0.85)] ring-1 ring-black/5 backdrop-blur-xl">
          {forgotMode ? (
            forgotSent ? (
              <Button
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => {
                  setForgotMode(false);
                  setForgotSent(false);
                }}
              >
                Back to sign in
              </Button>
            ) : (
              <form onSubmit={onForgotSubmit} className="space-y-4">
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
                    className="h-12 rounded-xl text-[15px]"
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
            <form onSubmit={onSubmit} className="space-y-4">
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
                  className="h-12 rounded-xl text-[15px]"
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
                  className="h-12 rounded-xl text-[15px]"
                  required
                />
              </div>
              <Button
                type="submit"
                size="lg"
                loading={loading}
                className="w-full bg-gradient-to-r from-brand-600 to-brand-500 shadow-[var(--shadow-brand)] hover:from-brand-700 hover:to-brand-600"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          )}
        </div>

        {/* Trust footer */}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Lock className="size-3.5" /> Authorized personnel only · Secured connection
        </p>
      </div>
    </div>
  );
}
