import { contextBridge, ipcRenderer } from 'electron';

/**
 * Bridge exposed to the (isolated) renderer as `window.kiosk`. The check-in web page detects
 * this to send kiosk context, print badges, and reset between visitors. Kept minimal per
 * Electron security guidance — only these calls cross the boundary.
 */
const config = {
  facilityId: process.env.KIOSK_FACILITY_ID || undefined,
  deviceId: process.env.KIOSK_DEVICE_ID || 'kiosk-1',
  webUrl: process.env.KIOSK_WEB_URL || 'http://localhost:5173',
};

contextBridge.exposeInMainWorld('kiosk', {
  isKiosk: true,
  config,
  printBadge: (badge: unknown) => ipcRenderer.invoke('kiosk:print-badge', badge),
  reset: () => ipcRenderer.invoke('kiosk:reset'),
});
