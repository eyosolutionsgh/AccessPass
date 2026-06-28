import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { Tooltip } from './tooltip.tsx';

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** Render in a destructive (red) style. */
  danger?: boolean;
  disabled?: boolean;
};

/**
 * Kebab (⋯) context menu for row/card actions. Renders the panel in a portal positioned from the
 * trigger's rect, so it's never clipped by a scroll container (e.g. a table). Closes on outside
 * click, Escape, or scroll/resize.
 */
export function ActionMenu({
  items,
  ariaLabel = 'Actions',
  className,
}: {
  items: MenuItem[];
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  /** Approx. menu height (item rows + padding) to decide whether to open up or down. */
  const APPROX_ITEM_H = 40;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  function toggle() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const right = Math.max(8, window.innerWidth - r.right);
      const estHeight = items.length * APPROX_ITEM_H + 12;
      const spaceBelow = window.innerHeight - r.bottom;
      // Flip upward when there isn't enough room below the trigger (e.g. last table rows).
      setPos(
        spaceBelow >= estHeight + 8
          ? { right, top: r.bottom + 4 }
          : { right, bottom: window.innerHeight - r.top + 4 },
      );
    }
    setOpen((o) => !o);
  }

  return (
    <>
      <Tooltip content={ariaLabel}>
        <button
          ref={btnRef}
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
          className={cn(
            'flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700',
            open && 'bg-slate-100 text-slate-700',
            className,
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </Tooltip>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              role="menu"
              style={{
                position: 'fixed',
                right: pos.right,
                ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }),
              }}
              className="z-50 min-w-44 animate-scale-in rounded-xl border border-slate-200/80 bg-white p-1 shadow-lg ring-1 ring-slate-900/[0.04]"
            >
              {items.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
                    item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-700 hover:bg-slate-100',
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
