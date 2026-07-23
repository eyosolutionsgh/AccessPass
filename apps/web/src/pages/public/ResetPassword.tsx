import { CheckCircle2, Lock, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { resetPassword } from '../../lib/auth.ts';
import { useOrgName } from '../../lib/branding.ts';
import { useAsyncStatus } from '../../lib/hooks.ts';
import { AuthScreen } from '../../components/AuthScreen.tsx';
import { AsyncButton, AsyncStatusMessage } from '../../components/ui/async-button.tsx';
import { Button } from '../../components/ui/button.tsx';
import { PasswordInput } from '../../components/ui/input.tsx';

/**
 * Public landing page for the emailed "set your password" link. better-auth validates the token
 * server-side and redirects here with `?token=…` (or `?error=INVALID_TOKEN`). The user picks a
 * password via `resetPassword`, then we send them to the sign-in screen. Shares the immersive
 * `AuthScreen` chrome with the staff sign-in and kiosk post screens.
 */
export function ResetPassword() {
  const [, navigate] = useLocation();
  const { token, linkError } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return { token: params.get('token'), linkError: params.get('error') };
  }, []);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const { status, error, run } = useAsyncStatus();
  const orgName = useOrgName();

  const invalid = !token || !!linkError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'pending') return;
    await run(async () => {
      // Validation failures throw so they surface through the same status/live-region path.
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      if (password !== confirm) throw new Error('Passwords do not match.');
      const { error: err } = await resetPassword({ newPassword: password, token: token! });
      if (err) throw new Error(err.message ?? 'Could not set your password. Try again.');
      // Success swaps to the "All set" screen below, then bounces to sign-in.
      setDone(true);
      setTimeout(() => navigate('/'), 1200);
    });
  }

  if (done) {
    return (
      <AuthScreen
        title="All set"
        subtitle="Your password is set — taking you to sign in…"
        icon={
          <span className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[var(--shadow-brand)] ring-1 ring-white/20">
            <CheckCircle2 className="size-10" />
          </span>
        }
      >
        <Button className="w-full" size="lg" onClick={() => navigate('/')}>
          Continue to sign in
        </Button>
      </AuthScreen>
    );
  }

  if (invalid) {
    return (
      <AuthScreen
        title="Link expired"
        subtitle="This password link is invalid or has expired."
        icon={
          <span className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[var(--shadow-brand)] ring-1 ring-white/20">
            <TriangleAlert className="size-10" />
          </span>
        }
      >
        <p className="text-center text-sm text-slate-600">
          Ask an administrator to re-send your invitation, then open the new link.
        </p>
        <Button variant="outline" size="lg" className="mt-5 w-full" onClick={() => navigate('/')}>
          Back to sign in
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      eyebrow="Activate account"
      title="Set your password"
      subtitle={`Choose a password to activate your account at ${orgName}.`}
      footer={
        <>
          <Lock className="size-3.5" /> Authorized personnel only · Secured connection
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4 text-left">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            New password
          </label>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="h-12 rounded-xl text-[15px]"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Confirm password
          </label>
          <PasswordInput
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className="h-12 rounded-xl text-[15px]"
            required
          />
        </div>
        <AsyncButton
          status={status}
          size="lg"
          labels={{
            idle: 'Set password & continue',
            pending: 'Saving…',
            success: 'All set!',
            error: 'Try again',
          }}
          className="w-full bg-gradient-to-r from-brand-600 to-brand-500 shadow-[var(--shadow-brand)] hover:from-brand-700 hover:to-brand-600"
        />
        <AsyncStatusMessage
          status={status}
          error={error}
          successMessage="Password set."
          className="text-center"
        />
      </form>
    </AuthScreen>
  );
}
