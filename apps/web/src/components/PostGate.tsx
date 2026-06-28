import { LogOut, Lock, Mail, ShieldCheck, ShieldAlert } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { anyRoleHasPermission, type PermissionRequest } from '@vms/shared';
import { signIn, signOut, useSettledSession } from '../lib/auth.ts';
import { trpc } from '../lib/trpc.ts';
import { Button } from './ui/button.tsx';
import { InputWithIcon } from './ui/input.tsx';

type Props = {
  /** The kiosk device this post is running on — gates sign-in and records the staffing session. */
  deviceId?: string;
  /** Permission a staff member needs to operate this post (e.g. `{ checkin: ['process'] }`). */
  permission: PermissionRequest;
  /** What to call the post in copy, e.g. "check-in desk", "checkout desk", "checkpoint". */
  postLabel: string;
  children: ReactNode;
};

/**
 * Gates a self-service post behind a staff sign-in AND a point assignment: a visitor can only
 * scan/enter their own code once a staff member who is (a) permitted to operate the post and
 * (b) assigned to the point this device is stationed at is signed in. The server opens a live
 * staffing session so admins can see who is at post; sign-out closes it.
 */
export function PostGate({ deviceId, permission, postLabel, children }: Props) {
  const { data: session, isPending } = useSettledSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const postSignIn = trpc.checkin.postSignIn.useMutation();
  const postSignOut = trpc.checkin.postSignOut.useMutation();

  const role = (session?.user as { role?: string | null } | undefined)?.role ?? null;
  const name = (session?.user as { name?: string | null } | undefined)?.name ?? null;
  const authorizedByRole = !!session && anyRoleHasPermission(role, permission);

  // Once a role-permitted user is present, open (and validate) the device's staffing session. Fails
  // closed — a user not assigned to this device's point is denied entry to the post.
  const attemptedRef = useRef<string | null>(null);
  const [post, setPost] = useState<{
    status: 'pending' | 'ok' | 'denied';
    message?: string;
    pointName?: string;
  }>({ status: 'pending' });

  useEffect(() => {
    if (!authorizedByRole) return;
    const key = `${session?.user?.id ?? ''}:${deviceId ?? ''}`;
    if (attemptedRef.current === key) return;
    attemptedRef.current = key;
    if (!deviceId) {
      setPost({
        status: 'denied',
        message:
          'This device isn’t set up yet. Open Kiosk setup to give it a device ID, then ask an admin to assign it to a point.',
      });
      return;
    }
    setPost({ status: 'pending' });
    postSignIn
      .mutateAsync({ deviceId })
      .then((r) => setPost({ status: 'ok', pointName: r.pointName }))
      .catch((e: { message?: string }) =>
        setPost({
          status: 'denied',
          message: e?.message ?? 'You are not authorized to operate this post.',
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorizedByRole, deviceId, session?.user?.id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message ?? 'Sign in failed');
    setPassword('');
    // The staffing session is opened by the effect above once the session resolves.
  }

  async function onLogout() {
    setLoggingOut(true);
    if (deviceId) await postSignOut.mutateAsync({ deviceId }).catch(() => {});
    attemptedRef.current = null;
    setPost({ status: 'pending' });
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
            className="h-14 text-base"
            required
          />
          <InputWithIcon
            icon={<Lock />}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="h-14 text-base"
            required
          />
          <Button type="submit" className="h-14 w-full text-base" size="lg" loading={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    );
  }

  // Signed in, but the account's role can't operate this kind of post at all.
  if (!authorizedByRole) {
    return (
      <PostBlocked
        tone="amber"
        title="No access to this post"
        message={`${name ?? 'This account'} isn’t permitted to operate the ${postLabel}. Sign in with a different account.`}
        loggingOut={loggingOut}
        onLogout={onLogout}
      />
    );
  }

  // Role is fine, but the assignment / device gate denied (or is still resolving).
  if (post.status === 'denied') {
    return (
      <PostBlocked
        tone="red"
        title="Not assigned to this post"
        message={post.message ?? 'You are not assigned to operate this device.'}
        loggingOut={loggingOut}
        onLogout={onLogout}
      />
    );
  }

  if (post.status !== 'ok') return null; // resolving the staffing session

  return (
    <>
      <div className="fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-3 pr-1.5 text-xs font-medium text-slate-600 shadow-lg ring-1 ring-slate-900/5 backdrop-blur">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {name ?? 'Signed in'}
        {post.pointName && <span className="text-slate-400">· {post.pointName}</span>}
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          aria-label="Sign out"
          className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          <LogOut className="size-4" />
        </button>
      </div>
      {children}
    </>
  );
}

/** Full-card "you can't operate this post" state with a sign-out action. */
function PostBlocked({
  tone,
  title,
  message,
  loggingOut,
  onLogout,
}: {
  tone: 'amber' | 'red';
  title: string;
  message: string;
  loggingOut: boolean;
  onLogout: () => void;
}) {
  const toneCls = tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600';
  return (
    <div className="text-center">
      <div className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${toneCls}`}>
        <ShieldAlert className="size-7" />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-1.5 text-sm text-slate-500">{message}</p>
      <Button variant="outline" className="mt-6 w-full" loading={loggingOut} onClick={onLogout}>
        Sign out
      </Button>
    </div>
  );
}
