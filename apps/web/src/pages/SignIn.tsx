import { CheckCircle2, HelpCircle, Lock, Mail } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { requestPasswordReset, signIn } from '../lib/auth.ts';
import { useOrgName } from '../lib/branding.ts';
import { AuthScreen } from '../components/AuthScreen.tsx';
import { Button } from '../components/ui/button.tsx';
import { InputWithIcon, PasswordInput } from '../components/ui/input.tsx';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const orgName = useOrgName();
  useEffect(() => {
    document.title = orgName;
  }, [orgName]);

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
      : 'Sign in to continue';

  return (
    <AuthScreen
      title={title}
      subtitle={subtitle}
      icon={
        forgotSent ? (
          <span className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[var(--shadow-brand)] ring-1 ring-white/20">
            <CheckCircle2 className="size-10" />
          </span>
        ) : undefined
      }
      footer={
        <>
          <Lock className="size-3.5" /> Authorized personnel only · Secured connection
        </>
      }
      topRight={
        // Help / user manual — opens in a new tab; available before sign-in.
        <a
          href="/help"
          target="_blank"
          rel="noopener noreferrer"
          title="Open the user manual"
          className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        >
          <HelpCircle className="size-4" /> Help
        </a>
      }
    >
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
            <PasswordInput
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
    </AuthScreen>
  );
}
