import { type CheckInLookup, invitationCodeSchema } from '@vms/shared';

/**
 * Interpret a scanned QR payload as a check-in lookup. The invitation QR encodes the check-in URL
 * (`…/check-in?t=<token>`); some QR codes (or a typed value) carry just the raw invitation code.
 * Returns null when the payload is neither a valid token URL nor a valid code.
 */
export function parseScannedQr(text: string): CheckInLookup | null {
  const raw = text.trim();
  try {
    const token = new URL(raw).searchParams.get('t');
    if (token) return { kind: 'qr', token };
  } catch {
    /* not a URL — fall through to code parsing */
  }
  const parsed = invitationCodeSchema.safeParse(raw.toUpperCase());
  return parsed.success ? { kind: 'code', code: parsed.data } : null;
}
