import { useMemo } from 'react';
import { DEFAULT_DEVICE_PROFILE, type DeviceProfile } from '@vms/shared';
import { getKiosk } from './kiosk.ts';
import { trpc } from './trpc.ts';

/**
 * Per-device kiosk identity + profile resolution. A device's `deviceId` (from the native kiosk
 * shell, else bound on-device by redeeming an admin pairing code) keys its server-side profile. The
 * profile is ADMIN-AUTHORITATIVE: resolved = server registry → defaults. There is no on-device
 * profile override — scanner/printer/credential/NFC are configured in Admin → Devices.
 */
const DEVICE_ID_KEY = 'vms.kiosk.deviceId';

export function getLocalDeviceId(): string | undefined {
  try {
    return getKiosk()?.config.deviceId || localStorage.getItem(DEVICE_ID_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setLocalDeviceId(id: string | undefined): void {
  try {
    if (id) localStorage.setItem(DEVICE_ID_KEY, id);
    else localStorage.removeItem(DEVICE_ID_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Resolve this device's profile: server profile (by deviceId) → defaults. Server is authoritative. */
export function useDeviceProfile(): { deviceId?: string; profile: DeviceProfile } {
  const deviceId = getLocalDeviceId();
  const server = trpc.checkin.deviceProfile.useQuery(
    { deviceId: deviceId ?? '' },
    { enabled: Boolean(deviceId), retry: false, staleTime: Infinity },
  );
  return useMemo(() => {
    const profile: DeviceProfile = { ...DEFAULT_DEVICE_PROFILE, ...(server.data ?? {}) };
    return { deviceId, profile };
  }, [deviceId, server.data]);
}
