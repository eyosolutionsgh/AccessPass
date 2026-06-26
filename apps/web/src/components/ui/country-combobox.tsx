import { COUNTRIES } from '../../lib/countries.ts';
import { Combobox, type ComboItem } from './combobox.tsx';
import { CountryFlag } from './country-flag.tsx';

// Built once — local SVG flag + ISO-2 + dial code per country, value is the ISO-2 code.
const ITEMS: ComboItem[] = COUNTRIES.map((c) => ({
  value: c.iso2,
  label: c.name,
  keywords: `${c.iso2} +${c.dial} ${c.name}`,
  leading: <CountryFlag iso2={c.iso2} />,
  trailing: (
    <span className="flex shrink-0 items-center gap-2 font-mono text-xs text-slate-400">
      <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-500">
        {c.iso2}
      </span>
      +{c.dial}
    </span>
  ),
}));

export function CountryCombobox({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Combobox
      items={ITEMS}
      value={(value ?? '').toUpperCase()}
      onChange={onChange}
      placeholder="Select country…"
      searchPlaceholder="Search country, code or +dial…"
      emptyText="No country found"
      className={className}
    />
  );
}
