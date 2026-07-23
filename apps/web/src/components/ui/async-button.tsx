import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { type ReactNode } from 'react';
import { type AsyncStatus } from '../../lib/hooks.ts';
import { cn } from '../../lib/utils.ts';
import { Button, type ButtonProps } from './button.tsx';

export interface AsyncButtonProps extends Omit<ButtonProps, 'loading' | 'children'> {
  status: AsyncStatus;
  /** Label for each state; `pending` sits next to the spinner, `success`/`error` are self-narrating. */
  labels: { idle: ReactNode; pending: ReactNode; success: ReactNode; error: ReactNode };
  /** Leading icon shown in every state except `pending` (the spinner takes its place). */
  icon?: ReactNode;
}

/**
 * A {@link Button} bound to an {@link AsyncStatus} (see `useAsyncStatus`). It narrates its own work,
 * disables and shows a spinner while `pending` (with `aria-busy`), and greens on `success`. All four
 * labels are stacked in one grid cell so the widest reserves the width and the layout never jumps as
 * the label swaps.
 */
export function AsyncButton({
  status,
  labels,
  icon,
  variant,
  className,
  ...props
}: AsyncButtonProps) {
  const pending = status === 'pending';
  const states: AsyncStatus[] = ['idle', 'pending', 'success', 'error'];
  return (
    <Button
      type="submit"
      variant={status === 'success' ? 'success' : variant}
      loading={pending}
      aria-busy={pending}
      className={className}
      {...props}
    >
      {!pending && icon}
      <span className="grid">
        {states.map((s) => (
          <span
            key={s}
            aria-hidden={s !== status}
            className={cn('col-start-1 row-start-1 text-center', s !== status && 'invisible')}
          >
            {labels[s]}
          </span>
        ))}
      </span>
    </Button>
  );
}

export interface AsyncStatusMessageProps {
  status: AsyncStatus;
  error?: string | null;
  /** Shown on `success`. Pairs a word with the tick so the outcome survives colour blindness. */
  successMessage: ReactNode;
  className?: string;
}

/**
 * A polite live region for an {@link AsyncStatus}: the success or error message announced to a
 * screen reader, each pairing colour with an icon and a word. Reserves a line so nothing shifts.
 */
export function AsyncStatusMessage({
  status,
  error,
  successMessage,
  className,
}: AsyncStatusMessageProps) {
  return (
    <p role="status" aria-live="polite" className={cn('min-h-5 text-sm', className)}>
      {status === 'success' && (
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
          <CheckCircle2 className="size-4" aria-hidden /> {successMessage}
        </span>
      )}
      {status === 'error' && error && (
        <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
          <TriangleAlert className="size-4" aria-hidden /> {error}
        </span>
      )}
    </p>
  );
}
