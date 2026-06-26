import { Combobox, type ComboItem } from './combobox.tsx';

/** Full IANA zone list from the runtime (Intl) — no bundled data, air-gap safe. */
function listZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf;
    const zones = fn?.('timeZone');
    if (Array.isArray(zones) && zones.length) {
      return zones.includes('UTC') ? zones : ['UTC', ...zones];
    }
  } catch {
    /* fall through */
  }
  return ['UTC', 'Africa/Accra', 'Europe/London', 'America/New_York', 'Asia/Dubai'];
}

/** Current short offset for a zone, e.g. "GMT+0". */
function offsetLabel(tz: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? '';
  } catch {
    return '';
  }
}

const ITEMS: ComboItem[] = listZones().map((tz) => {
  const offset = offsetLabel(tz);
  return {
    value: tz,
    label: tz.replace(/_/g, ' '),
    keywords: `${tz} ${offset}`,
    trailing: offset ? <span className="font-mono text-xs text-slate-400">{offset}</span> : null,
  };
});

export function TimezoneCombobox({
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
      value={value}
      onChange={onChange}
      placeholder="Select timezone…"
      searchPlaceholder="Search city or offset…"
      emptyText="No timezone found"
      className={className}
    />
  );
}
