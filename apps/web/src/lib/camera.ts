/**
 * Per-device camera preference for the kiosk QR scanner. Stored in localStorage (each kiosk picks
 * its own camera once via the Camera setup screen). When unset, the scanner passes `undefined` to
 * zxing, which auto-selects the rear/environment camera.
 */
const KEY = 'vms.kiosk.cameraId';

export function getPreferredCameraId(): string | undefined {
  try {
    return localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setPreferredCameraId(id: string | undefined): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — scanner falls back to auto-select */
  }
}
