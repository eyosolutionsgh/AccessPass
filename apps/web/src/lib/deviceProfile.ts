import { useMemo } from 'react';
import { DEFAULT_DEVICE_PROFILE, type DeviceProfile } from '@vms/shared';
import { getKiosk } from './kiosk.ts';
import { trpc } from './trpc.ts';

/**
 * Per-device kiosk identity + profile resolution. A device's `deviceId` (from the native kiosk
 * shell, else set locally in Kiosk setup) keys its server-side profile/checkpoint. The resolved
 * profile = local override → server registry → defaults, so an unconfigured tablet just works.
 */
const DEVICE_ID_KEY = 'vms.kiosk.deviceId';
const PROFILE_KEY = 'vms.kiosk.deviceProfile';

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

export function getLocalProfileOverride(): Partial<DeviceProfile> | undefined {
  try {
    const json = localStorage.getItem(PROFILE_KEY);
    return json ? (JSON.parse(json) as Partial<DeviceProfile>) : undefined;
  } catch {
    return undefined;
  }
}

export function setLocalProfileOverride(p: Partial<DeviceProfile> | undefined): void {
  try {
    if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Resolve this device's profile: local override → server profile (by deviceId) → defaults. */
export function useDeviceProfile(): { deviceId?: string; profile: DeviceProfile } {
  const deviceId = getLocalDeviceId();
  const server = trpc.checkin.deviceProfile.useQuery(
    { deviceId: deviceId ?? '' },
    { enabled: Boolean(deviceId), retry: false, staleTime: Infinity },
  );
  return useMemo(() => {
    const profile: DeviceProfile = {
      ...DEFAULT_DEVICE_PROFILE,
      ...(server.data ?? {}),
      ...(getLocalProfileOverride() ?? {}),
    };
    return { deviceId, profile };
  }, [deviceId, server.data]);
}
