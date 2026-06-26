/**
 * Bridge to the Electron kiosk shell (see apps/kiosk). When the check-in page runs inside the
 * kiosk, `window.kiosk` is injected by the preload script. In a normal browser it's undefined,
 * so the page degrades gracefully (no printing, no auto-reset side effects).
 */
export type BadgeData = {
  visitorName: string;
  organization?: string | null;
  hostName?: string | null;
  facilityName?: string | null;
  badgeNumber: string;
  badgeToken?: string | null;
  date?: string;
};

export type KioskBridge = {
  isKiosk: boolean;
  config: { facilityId?: string; deviceId: string; webUrl: string };
  printBadge: (badge: BadgeData) => Promise<{ ok: boolean; path?: string }>;
  reset: () => Promise<{ ok: boolean }>;
  /**
   * Optional native hardware hooks, provided by a vendor kiosk shell (e.g. a ZCS/Sunmi/PAX Android
   * WebView app) and absent in a plain browser. The check-in page calls them only when the device
   * profile selects them, and falls back to the browser camera / no-op when they're missing.
   */
  scanQr?: () => Promise<string | null>;
  readNfc?: () => Promise<string | null>;
  issueTag?: () => Promise<string | null>;
};

declare global {
  interface Window {
    kiosk?: KioskBridge;
  }
}

export function getKiosk(): KioskBridge | undefined {
  return typeof window !== 'undefined' ? window.kiosk : undefined;
}
