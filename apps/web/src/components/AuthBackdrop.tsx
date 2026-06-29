import { MapPin, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils.ts';

/** Decorative facility checkpoints scattered over the backdrop — purely visual. */
const PINS = [
  { top: '18%', left: '13%', size: 'size-7', tone: 'text-brand-300/70' },
  { top: '26%', left: '85%', size: 'size-5', tone: 'text-accent-400/70' },
  { top: '72%', left: '16%', size: 'size-6', tone: 'text-brand-200/60' },
  { top: '78%', left: '83%', size: 'size-7', tone: 'text-brand-300/60' },
];

/**
 * Immersive decorative backdrop shared by the staff sign-in and the kiosk post screens:
 * a stylised map of facility checkpoints — floating brand blobs, a faint grid, a giant
 * shield watermark and scattered map pins. Purely visual; pointer events are disabled.
 * Render it inside a `position: relative`, `overflow-hidden` container.
 */
export function AuthBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div className="bg-grid absolute inset-0 opacity-[0.07]" />
      <div className="absolute -left-32 -top-32 size-[34rem] animate-float-slow rounded-full bg-brand-500/30 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 size-[36rem] animate-float rounded-full bg-accent-500/20 blur-3xl" />
      <div className="absolute right-1/4 top-10 size-72 rounded-full bg-brand-400/20 blur-3xl" />

      {/* Giant faint shield watermark anchoring the security motif behind the card. */}
      <ShieldCheck
        className="absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-1/2 text-white/[0.04]"
        strokeWidth={0.5}
      />
      {PINS.map((p, i) => (
        <MapPin
          key={i}
          className={`absolute drop-shadow-lg ${p.size} ${p.tone}`}
          style={{ top: p.top, left: p.left }}
          fill="currentColor"
          fillOpacity={0.2}
        />
      ))}
    </div>
  );
}
