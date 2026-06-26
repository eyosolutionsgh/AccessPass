import { LogOut, Lock, Mail, ShieldCheck } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { anyRoleHasPermission, type PermissionRequest } from '@vms/shared';
import { signIn, signOut, useSession } from '../lib/auth.ts';
import { trpc } from '../lib/trpc.ts';
import { Button } from './ui/button.tsx';
import { InputWithIcon } from './ui/input.tsx';

type Props = {
  /** The kiosk device this post is running on — recorded against the sign-in/out audit trail. */
  deviceId?: string;
  /** Permission a staff member needs to operate this post (e.g. `{ checkin: ['process'] }`). */
  permission: PermissionRequest;
  /** What to call the post in copy, e.g. "check-in desk", "checkout desk", "checkpoint". */
  postLabel: string;
  children: ReactNode;
};

/**
 * Gates a self-service post behind a staff sign-in: visitors can only scan/enter their own
 * code once a staff member with the right permission is signed in, so there is always a record
 * of who was at post (SRS audit requirement — physical inspections need to verify staffing).
 */
export function PostGate({ deviceId, permission, postLabel, children }: Props) {
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const postSignIn = trpc.checkin.postSignIn.useMutation();
  const postSignOut = trpc.checkin.postSignOut.useMutation();

  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const name = (session?.user as { name?: string | null } | undefined)?.name ?? null;
  const authorized = !!session && anyRoleHasPermission(role, permission);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message ?? 'Sign in failed');
    setPassword('');
    if (deviceId) postSignIn.mutate({ deviceId });
  }

  async function onLogout() {
    setLoggingOut(true);
    if (deviceId) await postSignOut.mutateAsync({ deviceId }).catch(() => {});
    await signOut();
    setLoggingOut(false);
  }

  if (isPending) return null;

  if (!session) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <ShieldCheck className="size-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">Sign in</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Sign in to open the {postLabel} for visitors.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3 text-left">
          <InputWithIcon
            icon={<Mail />}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
          <InputWithIcon
            icon={<Lock />}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <ShieldCheck className="size-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">
          No access to this post
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {name ?? 'This account'} isn&apos;t permitted to operate the {postLabel}. Sign in with a
          different account.
        </p>
        <Button variant="outline" className="mt-6 w-full" loading={loggingOut} onClick={onLogout}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-10 flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-3 pr-1.5 text-xs font-medium text-slate-600 shadow-lg ring-1 ring-slate-900/5 backdrop-blur">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {name ?? 'Signed in'}
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>
      {children}
    </>
  );
}
