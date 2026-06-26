import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Phone helpers (offline — libphonenumber-js bakes its metadata in, so this is air-gap safe).
 * "Local" = the number resolves to the configured default country; used to gate SMS, since the
 * Nalo gateway targets local subscribers and international SMS is typically out of scope.
 */

/**
 * True when `phone` is a valid number for `country` (ISO-2). A national-format number
 * (e.g. `0244123456`) is interpreted against `country`; an international number (e.g. `+44…`)
 * is matched on its own country, so a foreign number returns false.
 */
export function isLocalNumber(phone: string | null | undefined, country: string): boolean {
  if (!phone) return false;
  const cc = country.toUpperCase() as CountryCode;
  const parsed = parsePhoneNumberFromString(phone, cc);
  return Boolean(parsed?.isValid() && parsed.country === cc);
}

/** Normalise to E.164 (e.g. `+233244123456`) when parseable for `country`, else null. */
export function toE164(phone: string | null | undefined, country: string): string | null {
  if (!phone) return null;
  const parsed = parsePhoneNumberFromString(phone, country.toUpperCase() as CountryCode);
  return parsed?.isValid() ? parsed.number : null;
}
