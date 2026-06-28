import { CheckCircle2, Lock, TriangleAlert } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { resetPassword } from '../../lib/auth.ts';
import { useOrgName } from '../../lib/branding.ts';
import { Logo } from '../../components/Logo.tsx';
import { Button } from '../../components/ui/button.tsx';
import { InputWithIcon } from '../../components/ui/input.tsx';

/**
 * Public landing page for the emailed "set your password" link. better-auth validates the token
 * server-side and redirects here with `?token=…` (or `?error=INVALID_TOKEN`). The user picks a
 * password via `resetPassword`, then we send them to the sign-in screen.
 */
export function ResetPassword() {
  const [, navigate] = useLocation();
  const { token, linkError } = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return { token: params.get('token'), linkError: params.get('error') };
  }, []);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const orgName = useOrgName();

  const invalid = !token || !!linkError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error('Password must be at least 8 characters.');
    if (password !== confirm) return toast.error('Passwords do not match.');
    setLoading(true);
    const { error } = await resetPassword({ newPassword: password, token: token! });
    setLoading(false);
    if (error) return toast.error(error.message ?? 'Could not set your password. Try again.');
    setDone(true);
    toast.success('Password set — you can now sign in.');
    setTimeout(() => navigate('/'), 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 bg-grid px-4 py-12">
      <div className="w-full max-w-sm animate-rise">
        <div className="mb-8 flex justify-center">
          <Logo className="size-12 rounded-2xl shadow-[var(--shadow-brand)]" />
        </div>

        {done ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-lg ring-1 ring-slate-900/[0.02]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-6" />
            </span>
            <h1 className="mt-4 text-lg font-bold tracking-tight text-slate-900">All set</h1>
            <p className="mt-1 text-sm text-slate-500">Redirecting you to sign in…</p>
          </div>
        ) : invalid ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-lg ring-1 ring-slate-900/[0.02]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <TriangleAlert className="size-6" />
            </span>
            <h1 className="mt-4 text-lg font-bold tracking-tight text-slate-900">Link expired</h1>
            <p className="mt-1 text-sm text-slate-500">
              This password link is invalid or has expired. Ask an administrator to re-send your
              invitation.
            </p>
            <Button variant="outline" className="mt-5 w-full" onClick={() => navigate('/')}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-7 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                {orgName}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Set your password
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Choose a password to activate your staff account.
              </p>
            </div>

            <form
              onSubmit={onSubmit}
              className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-lg ring-1 ring-slate-900/[0.02]"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  New password
                </label>
                <InputWithIcon
                  icon={<Lock />}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Confirm password
                </label>
                <InputWithIcon
                  icon={<Lock />}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                {loading ? 'Saving…' : 'Set password & continue'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
