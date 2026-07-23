import { KeyRound, UserRound } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { changePassword, useSettledSession } from '../lib/auth.ts';
import { useAsyncStatus } from '../lib/hooks.ts';
import { AsyncButton, AsyncStatusMessage } from '../components/ui/async-button.tsx';
import { Card, CardContent, CardHeader } from '../components/ui/card.tsx';
import { PasswordInput } from '../components/ui/input.tsx';
import { PageHeader } from '../components/ui/page-header.tsx';

const MIN_LENGTH = 8;

/**
 * Self-service account settings for the signed-in user. Right now it hosts the change-password
 * form (current → new → confirm), backed by better-auth's `changePassword`, which verifies the
 * current password server-side and — with `revokeOtherSessions` — signs every other session out.
 * This is the "change my password while signed in" counterpart to the emailed reset link that
 * `/reset-password` handles for invitations and forgotten passwords.
 */
export function Account() {
  const { data: session } = useSettledSession();
  const email = session?.user.email;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const { status, error, run } = useAsyncStatus();

  // Keep the field the user should fix next in focus after a bad current password.
  const currentRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'pending') return;
    await run(async () => {
      // Validation failures throw so they surface through the same status/live-region path.
      if (next.length < MIN_LENGTH)
        throw new Error(`New password must be at least ${MIN_LENGTH} characters.`);
      if (next !== confirm) throw new Error('New passwords do not match.');
      if (next === current) throw new Error('New password must differ from your current one.');

      const { error: err } = await changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (err) {
        currentRef.current?.focus();
        throw new Error(
          err.message ?? 'Current password is incorrect, or the new one was rejected.',
        );
      }

      setCurrent('');
      setNext('');
      setConfirm('');
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Your account"
        title="Account settings"
        description={email ? `Signed in as ${email}` : 'Manage your sign-in credentials'}
        icon={UserRound}
      />

      <Card>
        <CardHeader
          icon={<KeyRound />}
          title="Change password"
          description="Update the password you use to sign in. Your other sessions will be signed out."
        />
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="current-password" className="text-sm font-medium text-slate-700">
                Current password
              </label>
              <PasswordInput
                id="current-password"
                ref={currentRef}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                placeholder="Your current password"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium text-slate-700">
                New password
              </label>
              <PasswordInput
                id="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                placeholder={`At least ${MIN_LENGTH} characters`}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                required
              />
            </div>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <AsyncButton
                status={status}
                icon={<KeyRound className="size-4" />}
                labels={{
                  idle: 'Change password',
                  pending: 'Saving…',
                  success: 'Saved!',
                  error: "Couldn't save",
                }}
                // Reserve the widest label's width so the layout never jumps as it narrates.
                className="w-full sm:w-52"
              />
              <AsyncStatusMessage
                status={status}
                error={error}
                successMessage="Password changed."
              />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
