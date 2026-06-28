import { Logo } from '../../components/Logo.tsx';
import { useOrgName } from '../../lib/branding.ts';

/** Institution lockup (logo + name) pinned to the top of every kiosk post, so visitors always
 * see who they're checking in with. Logo resolves to the admin-uploaded one or the default. */
function KioskBrand() {
  const orgName = useOrgName();
  return (
    <div className="mb-6 flex shrink-0 flex-col items-center gap-2 border-b border-slate-100 pb-5 text-center">
      <Logo className="size-12 rounded-2xl" />
      <span className="text-base font-semibold tracking-tight text-slate-900">{orgName}</span>
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
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-white select-none [-webkit-tap-highlight-color:transparent] lg:items-center lg:justify-center lg:bg-mesh lg:p-6">
      <div className="pointer-events-none absolute inset-0 hidden bg-grid opacity-[0.04] lg:block" />
      <div className="relative flex w-full flex-1 flex-col bg-white px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:max-w-lg lg:flex-none lg:animate-scale-in lg:rounded-3xl lg:px-10 lg:py-10 lg:shadow-2xl lg:ring-1 lg:ring-black/5">
        <KioskBrand />
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-md lg:max-w-none">{children}</div>
        </div>
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
