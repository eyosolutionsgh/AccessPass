import type { ReactNode } from 'react';
import { AuthBackdrop } from './AuthBackdrop.tsx';
import { Logo } from './Logo.tsx';

/**
 * Shared full-screen scaffold for every "sign in" surface — the staff sign-in page and the
 * kiosk post sign-in / blocked screens. Renders the immersive dark mesh backdrop, a centred
 * logo-lockup (logo + title + subtitle) floating above a white card, and an optional trust
 * footer, so every login surface is visually identical.
 */
export function AuthScreen({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
  footer,
  topRight,
}: {
  /** Small uppercase label above the title (e.g. "Staff sign in") for extra context. */
  eyebrow?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** Replaces the default institution logo above the title (e.g. a success / alert badge). */
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  topRight?: ReactNode;
}) {
  return (
    <div className="bg-mesh relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-12">
      {topRight}
      {/* Immersive decorative backdrop — a stylised map of facility checkpoints, purely visual. */}
      <AuthBackdrop />

      <div className="relative z-10 w-full max-w-sm animate-rise">
        {/* Lockup */}
        <div className="mb-7 flex flex-col items-center text-center">
          {icon ?? (
            <Logo className="size-20 rounded-3xl shadow-[var(--shadow-brand)] ring-1 ring-white/20" />
          )}
          {eyebrow && (
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">
              {eyebrow}
            </p>
          )}
          <h1
            className={`font-bold tracking-tight text-white ${eyebrow ? 'mt-1.5 text-3xl' : 'mt-5 text-2xl'}`}
          >
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-300">{subtitle}</p>}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/60 bg-white/95 p-7 shadow-[0_30px_80px_-24px_oklch(0.272_0.09_270/0.85)] ring-1 ring-black/5 backdrop-blur-xl">
          {children}
        </div>

        {footer && (
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}
