/** Shared chrome for the kiosk-style post pages (check-in, check-out, checkpoint). */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-mesh p-6">
      <div className="absolute inset-0 bg-grid opacity-[0.04]" />
      <div className="relative w-full max-w-lg animate-scale-in rounded-3xl bg-white p-10 shadow-2xl ring-1 ring-black/5">
        {children}
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
      className="fixed bottom-4 left-4 z-10 text-xs text-white/30 transition-colors hover:text-white/60"
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
    <div className="flex items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-slate-500">
        {icon && <span className="text-slate-400 [&_svg]:size-4">{icon}</span>}
        {label}
      </span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
