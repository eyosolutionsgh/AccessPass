import type { DateFormat } from '@vms/shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a date in the configured timezone + admin-selected date format, with a 24h time suffix —
 * e.g. `15/03/2026, 14:30`. Timezone-correct parts are extracted via Intl, then assembled per the
 * chosen `dateFormat` so the output matches the system setting rather than a fixed locale.
 */
export function formatDateTime(
  date: Date,
  opts: { dateFormat: DateFormat; timeZone: string },
): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: opts.timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  const dd = get('day');
  const mm = get('month');
  const yyyy = get('year');
  const hh = get('hour');
  const min = get('minute');
  const monthName = MONTHS[Number(mm) - 1] ?? mm;

  let datePart: string;
  switch (opts.dateFormat) {
    case 'MM/DD/YYYY':
      datePart = `${mm}/${dd}/${yyyy}`;
      break;
    case 'YYYY-MM-DD':
      datePart = `${yyyy}-${mm}-${dd}`;
      break;
    case 'D MMM YYYY':
      datePart = `${Number(dd)} ${monthName} ${yyyy}`;
      break;
    case 'DD/MM/YYYY':
    default:
      datePart = `${dd}/${mm}/${yyyy}`;
      break;
  }
  return `${datePart}, ${hh}:${min}`;
}
