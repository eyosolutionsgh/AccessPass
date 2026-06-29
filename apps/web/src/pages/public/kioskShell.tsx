import { AuthBackdrop } from '../../components/AuthBackdrop.tsx';
import { Logo } from '../../components/Logo.tsx';
import { useOrgName } from '../../lib/branding.ts';

/** Institution lockup (logo + name) pinned to the top of every kiosk post, so visitors always
 * see who they're checking in with. Logo resolves to the admin-uploaded one or the default. */
function KioskBrand() {
  const orgName = useOrgName();
  return (
    <div className="mb-6 flex shrink-0 flex-col items-center gap-2.5 border-b border-slate-100 pb-5 text-center">
      <Logo className="size-20 rounded-3xl shadow-[var(--shadow-brand)] ring-1 ring-black/5" />
      <span className="text-lg font-semibold tracking-tight text-slate-900">{orgName}</span>
    </div>
  );
}

/**
 * Shared chrome for the kiosk-style post pages (check-in, check-out, checkpoint).
 *
 * Tablet/phone-first: by default the surface is full-bleed and fills the viewport like a native
 * app — the institution brand sits at the top, the post content is vertically centred in a
 * comfortable column below it, edges respect device safe areas, and text/tap-highlight selection
 * is suppressed so it doesn't feel like a web page. On large screens (`lg+`, desktops / landscape
 * tablets) it collapses back into the elegant floating card on the mesh backdrop.
 */
export function Shell({
  children,
  scroll = false,
  header,
}: {
  children: React.ReactNode;
  /** Top-align + scroll the content instead of vertically centring it — for longer forms (e.g. the
   * front-desk walk-in capture) that can exceed the viewport. Defaults to the centred kiosk look. */
  scroll?: boolean;
  /** Optional top-bar content (e.g. a Back button). Rendered as its own row ABOVE the brand so it
   * never collides with the brand or the fixed post chrome. */
  header?: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden bg-slate-950 select-none [-webkit-tap-highlight-color:transparent] lg:items-center lg:justify-center lg:bg-mesh lg:p-6 ${
        // Fixed height for scroll mode so the inner area can bound + scroll; min-height otherwise so
        // short centred posts can still grow on tiny screens.
        scroll ? 'h-[100dvh]' : 'min-h-[100dvh]'
      }`}
    >
      {/* Immersive backdrop matches the staff sign-in screen — large screens / landscape kiosks. */}
      <AuthBackdrop className="hidden lg:block" />
      <div className="relative flex w-full flex-1 flex-col overflow-hidden bg-white px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:max-h-[calc(100dvh-3rem)] lg:max-w-lg lg:flex-none lg:animate-rise lg:rounded-3xl lg:border lg:border-white/60 lg:bg-white/95 lg:px-10 lg:py-10 lg:shadow-[0_30px_80px_-24px_oklch(0.272_0.09_270/0.85)] lg:ring-1 lg:ring-black/5 lg:backdrop-blur-xl">
        {header && <div className="mb-1 flex min-h-10 shrink-0 items-center">{header}</div>}
        <KioskBrand />
        {scroll ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-md pb-8 lg:max-w-none">{children}</div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto w-full max-w-md lg:max-w-none">{children}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Always-reachable corner link to the device profile/camera setup screen — deliberately OUTSIDE
 * any staff-sign-in gate, since a freshly unboxed kiosk needs to be configured before anyone
 * can sign in to staff it.
 */
export function KioskSetupLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-10 rounded-lg px-2 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-600 lg:text-white/30 lg:hover:text-white/60"
    >
      Kiosk setup
    </button>
  );
}

export function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[15px]">
      <span className="flex shrink-0 items-center gap-2 text-slate-500">
        {icon && <span className="text-slate-400 [&_svg]:size-[18px]">{icon}</span>}
        {label}
      </span>
      <span className="truncate text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}
