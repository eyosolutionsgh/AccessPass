import {
  Children,
  forwardRef,
  isValidElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.ts';
import { Combobox, type ComboItem } from './combobox.tsx';

/** Flatten an <option>'s children (string/number/array/element) to its display text. */
function childText(node: ReactNode): string {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childText).join('');
  if (isValidElement(node)) return childText((node.props as { children?: ReactNode }).children);
  return '';
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value?: string | number | null;
  /** Event-shaped for drop-in compatibility with the old native <select> (`e.target.value`). */
  onChange?: (e: { target: { value: string } }) => void;
  /** Fired when the dropdown opens — use to lazily fetch heavy option lists (e.g. hosts). */
  onOpen?: () => void;
}

/**
 * Searchable select. API-compatible with a native `<select>` (takes `<option>` children and an
 * `e.target.value` onChange) but renders the searchable {@link Combobox} so EVERY dropdown in the
 * app is searchable. A `disabled` option becomes the (non-selectable) placeholder; other options —
 * including a `value=""` one like "All" / "None" — stay selectable.
 */
export function Select({ value, onChange, children, className, disabled, onOpen }: SelectProps) {
  const items: ComboItem[] = [];
  let placeholder: string | undefined;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const p = child.props as { value?: string | number; disabled?: boolean; children?: ReactNode };
    const label = childText(p.children).trim();
    if (p.disabled) {
      if (placeholder === undefined) placeholder = label;
      return; // disabled option = placeholder, not selectable
    }
    const v = p.value === undefined ? '' : String(p.value);
    items.push({ value: v, label: label || v });
  });

  return (
    <Combobox
      value={value == null ? '' : String(value)}
      onChange={(v) => onChange?.({ target: { value: v } })}
      items={items}
      placeholder={placeholder ?? 'Select…'}
      className={className}
      disabled={disabled}
      onOpen={onOpen}
    />
  );
}

/**
 * Plain native select — used where search would be noise (e.g. the per-page dropdown). Not
 * searchable by design.
 */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 py-2 text-sm text-slate-900 shadow-xs transition-colors hover:border-slate-400 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
    </div>
  ),
);
NativeSelect.displayName = 'NativeSelect';
