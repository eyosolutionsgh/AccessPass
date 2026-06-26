import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils.ts';

/**
 * Broadcast on `document` by overlays (e.g. Modal) when they open, so any open Combobox popover
 * closes instead of being left orphaned on top of / behind the overlay. Focus-independent, so it
 * works for keyboard, programmatic, and headless interactions alike.
 */
export const DISMISS_POPOVERS_EVENT = 'vms:dismiss-popovers';

export type ComboItem = {
  value: string;
  label: string;
  /** Extra text matched by the search box (codes, aliases, offsets…). */
  keywords?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

/**
 * Accessible, dependency-free searchable dropdown. The popover renders in a portal positioned
 * from the trigger's rect (flips up when low on space), so it's never clipped by a modal, card,
 * or scroll container. Keyboard: ↑/↓ to move, Enter to pick, Esc to close; closes on outside
 * click or scroll/resize.
 */
export function Combobox({
  value,
  onChange,
  items,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No matches',
  className,
  disabled,
  id,
  onOpen,
}: {
  value: string;
  onChange: (value: string) => void;
  items: ComboItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  /** Fired when the menu opens — use it to lazily fetch heavy option lists (e.g. hosts). */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [coords, setCoords] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = items.find((i) => i.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      `${i.label} ${i.value} ${i.keywords ?? ''}`.toLowerCase().includes(q),
    );
  }, [items, query]);

  function openMenu() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const spaceBelow = window.innerHeight - r.bottom;
      const estHeight = 320; // search box + max-h list
      const flipUp = spaceBelow < estHeight && r.top > spaceBelow;
      setCoords({
        left: r.left,
        width: r.width,
        ...(flipUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      });
    }
    setOpen(true);
    onOpen?.();
  }

  // Close on outside click (trigger + portal panel), focus moving away (keyboard tab-out or an
  // overlay/modal stealing focus — otherwise the portal popover is left orphaned), scroll, or resize.
  useEffect(() => {
    if (!open) return;
    const isOutside = (t: Node) =>
      !triggerRef.current?.contains(t) && !panelRef.current?.contains(t);
    function onDocMouseDown(e: MouseEvent) {
      if (isOutside(e.target as Node)) setOpen(false);
    }
    function onFocusIn(e: FocusEvent) {
      if (isOutside(e.target as Node)) setOpen(false);
    }
    const close = () => setOpen(false);
    // Close on a page/ancestor scroll (the anchor moves out from under us) — but NOT when the
    // user scrolls the popover's OWN option list, otherwise it vanishes as soon as they scroll
    // the results.
    function onScroll(e: Event) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('focusin', onFocusIn);
    // An overlay opening over us (e.g. a modal) broadcasts this so we don't render orphaned.
    document.addEventListener(DISMISS_POPOVERS_EVENT, close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener(DISMISS_POPOVERS_EVENT, close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  // Focus the search box on open; clear the query on close.
  useEffect(() => {
    if (open) {
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    setQuery('');
    return undefined;
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[active];
      if (it) choose(it.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white pl-3 pr-2.5 text-left text-sm text-slate-900 shadow-xs transition-colors hover:border-slate-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
          {selected ? (
            <>
              {selected.leading}
              <span className="truncate">{selected.label}</span>
              {selected.trailing}
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              left: coords.left,
              width: coords.width,
              ...(coords.top != null ? { top: coords.top } : { bottom: coords.bottom }),
            }}
            className="z-[60] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5 animate-scale-in"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-3">
              <Search className="size-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="h-10 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <ul ref={listRef} role="listbox" className="max-h-64 overflow-auto p-1">
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-400">{emptyText}</li>
              )}
              {filtered.map((it, idx) => {
                const isSelected = it.value === value;
                const isActive = idx === active;
                return (
                  <li
                    key={it.value}
                    role="option"
                    aria-selected={isSelected}
                    data-active={isActive}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => choose(it.value)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                      isActive ? 'bg-brand-50 text-brand-900' : 'text-slate-700',
                    )}
                  >
                    {it.leading}
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.trailing}
                    {isSelected && <Check className="size-4 shrink-0 text-brand-600" />}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
