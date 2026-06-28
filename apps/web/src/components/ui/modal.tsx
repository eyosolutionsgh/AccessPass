import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { DISMISS_POPOVERS_EVENT } from './combobox.tsx';
import { Tooltip } from './tooltip.tsx';

/**
 * Lightweight, dependency-free modal. Renders into <body> via a portal, traps scroll, and closes
 * on Escape or backdrop click. Matches the app's card aesthetic (no Radix — keeps the air-gap
 * bundle lean). Render conditionally: callers mount it only when `open` to reset internal state.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Close any popover (e.g. an open combobox) left open in the background so it isn't orphaned
    // over the modal. Focus-independent — works regardless of where focus currently sits.
    document.dispatchEvent(new Event(DISMISS_POPOVERS_EVENT));
    // Move focus into the dialog (standard modal a11y; also dismisses popovers in real browsers).
    const focusTimer = setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'relative flex w-full max-w-md animate-scale-in flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl focus:outline-none',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 [&_svg]:size-4.5">
                {icon}
              </span>
            )}
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
              {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
            </div>
          </div>
          <Tooltip content="Close this dialog">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          </Tooltip>
        </div>

        <div className="p-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
