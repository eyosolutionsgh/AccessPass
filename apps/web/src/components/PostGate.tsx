import { LogOut, Lock, ShieldAlert, Wrench } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { anyRoleHasPermission, type PermissionRequest } from '@vms/shared';
import { signOut, useSettledSession } from '../lib/auth.ts';
import { signInUrlFor } from '../lib/postRoutes.ts';
import { trpc } from '../lib/trpc.ts';
import { AuthScreen } from './AuthScreen.tsx';
import { Button } from './ui/button.tsx';

type Props = {
  /** The kiosk device this post is running on — gates sign-in and records the staffing session. */
  deviceId?: string;
  /** Permission a staff member needs to operate this post (e.g. `{ checkin: ['process'] }`). */
  permission: PermissionRequest;
  /** What to call the post in copy, e.g. "check-in desk", "checkout desk", "checkpoint". */
  postLabel: string;
  /** Open the device/point setup flow — shown as the CTA when the device isn't paired to a point. */
  onSetup?: () => void;
  children: ReactNode;
};

/**
 * Gates a self-service post behind a staff sign-in AND a point assignment: a visitor can only
 * scan/enter their own code once a staff member who is (a) permitted to operate the post and
 * (b) assigned to the point this device is stationed at is signed in. The server opens a live
 * staffing session so admins can see who is at post; sign-out closes it.
 */
export function PostGate({ deviceId, permission, postLabel, onSetup, children }: Props) {
  const { data: session, isPending } = useSettledSession();
  const [location] = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const postSignIn = trpc.checkin.postSignIn.useMutation();
  const postSignOut = trpc.checkin.postSignOut.useMutation();

  // Pre-sign-in posting status: a paired device (registered + stationed at an active point) sends
  // an unstaffed post to the sign-in screen; an unpaired one shows a Point Setup CTA instead.
  const devicePost = trpc.checkin.devicePost.useQuery(
    { deviceId: deviceId ?? '' },
    { enabled: Boolean(deviceId), staleTime: 30_000 },
  );
  const paired = Boolean(deviceId) && Boolean(devicePost.data?.paired);

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
    // Resolving the device's posting status — avoid flashing the wrong screen.
    if (deviceId && devicePost.isLoading) return null;

    // Not paired to a point yet → don't offer sign-in; guide the operator to set the device up.
    if (!paired) {
      return (
        <AuthScreen
          eyebrow="Device setup"
          title="Point setup required"
          subtitle="This device isn't paired to a point yet, so it can't open a post for visitors."
          icon={
            <span className="flex size-20 items-center justify-center rounded-3xl bg-brand-500/15 text-brand-200 ring-1 ring-brand-300/20">
              <Wrench className="size-10" />
            </span>
          }
          footer={
            <>
              <Lock className="size-3.5" /> Authorized personnel only
            </>
          }
        >
          <p className="text-center text-sm text-slate-600">
            Pair this device to a reception or checkpoint point, then staff can sign in here.
          </p>
          {onSetup && (
            <Button
              size="lg"
              className="mt-5 w-full bg-gradient-to-r from-brand-600 to-brand-500 shadow-[var(--shadow-brand)] hover:from-brand-700 hover:to-brand-600"
              onClick={onSetup}
            >
              <Wrench className="size-4" /> Set up this point
            </Button>
          )}
        </AuthScreen>
      );
    }

    // Paired but nobody at post → the single sign-in screen, which brings them back here.
    return <Redirect to={signInUrlFor(location)} replace />;
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
      <div className="fixed right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 flex max-w-[88vw] items-center gap-2 rounded-full bg-white/95 py-1.5 pl-3 pr-1.5 text-xs font-medium text-slate-600 shadow-lg ring-1 ring-slate-900/5 backdrop-blur">
        <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
        <span className="shrink-0">{name ?? 'Signed in'}</span>
        {(devicePost.data?.facilityName || post.pointName) && (
          <span className="truncate text-slate-400">
            · {[devicePost.data?.facilityName, post.pointName].filter(Boolean).join(' · ')}
          </span>
        )}
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

/** Full-screen "you can't operate this post" state with a sign-out action. */
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
  const toneCls =
    tone === 'red'
      ? 'bg-red-500/15 text-red-200 ring-red-300/20'
      : 'bg-amber-500/15 text-amber-200 ring-amber-300/20';
  return (
    <AuthScreen
      title={title}
      icon={
        <span className={`flex size-20 items-center justify-center rounded-3xl ring-1 ${toneCls}`}>
          <ShieldAlert className="size-10" />
        </span>
      }
    >
      <p className="text-center text-sm text-slate-600">{message}</p>
      <Button
        variant="outline"
        size="lg"
        className="mt-5 w-full"
        loading={loggingOut}
        onClick={onLogout}
      >
        Sign out
      </Button>
    </AuthScreen>
  );
}
