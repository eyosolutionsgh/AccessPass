import { type ReactNode, useState } from 'react';
import {
  CREDENTIAL_MODE_LABELS,
  DEVICE_TYPE_LABELS,
  PRINTER_TARGET_LABELS,
  SCANNER_SOURCE_LABELS,
  credentialModeSchema,
  deviceTypeSchema,
  printerTargetSchema,
  scannerSourceSchema,
  type DeviceProfile,
} from '@vms/shared';
import {
  getLocalDeviceId,
  getLocalProfileOverride,
  setLocalDeviceId,
  setLocalProfileOverride,
} from '../lib/deviceProfile.ts';
import { CameraSetup } from './CameraSetup.tsx';
import { Button } from './ui/button.tsx';
import { Input } from './ui/input.tsx';
import { Select } from './ui/select.tsx';

/**
 * Kiosk setup (superset of Camera setup) — sets this device's identity (`deviceId`, which keys its
 * server-side checkpoint/profile) plus a local profile override (device type, scanner source,
 * credential mode, printer, NFC) and the camera. Persisted per kiosk in localStorage.
 */
export function KioskSetup({ onClose }: { onClose: () => void }) {
  const [showCamera, setShowCamera] = useState(false);
  const ov = getLocalProfileOverride() ?? {};
  const [deviceId, setDeviceId] = useState(getLocalDeviceId() ?? '');
  const [deviceType, setDeviceType] = useState<DeviceProfile['deviceType']>(ov.deviceType ?? 'generic');
  const [scannerSource, setScannerSource] = useState<DeviceProfile['scannerSource']>(
    ov.scannerSource ?? 'camera',
  );
  const [credentialMode, setCredentialMode] = useState<DeviceProfile['credentialMode']>(
    ov.credentialMode ?? 'qr',
  );
  const [printerTarget, setPrinterTarget] = useState<DeviceProfile['printerTarget']>(
    ov.printerTarget ?? 'off',
  );
  const [nfcEnabled, setNfcEnabled] = useState<boolean>(ov.nfcEnabled ?? false);
  const [saved, setSaved] = useState(false);

  if (showCamera) return <CameraSetup onClose={() => setShowCamera(false)} />;

  function save() {
    setLocalDeviceId(deviceId.trim() || undefined);
    setLocalProfileOverride({ deviceType, scannerSource, credentialMode, printerTarget, nfcEnabled });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="text-left">
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">Kiosk setup</h1>
      <p className="mt-1.5 text-center text-sm text-slate-600">Configure this device / checkpoint.</p>

      <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        Device / checkpoint ID
      </label>
      <Input
        value={deviceId}
        onChange={(e) => setDeviceId(e.target.value)}
        placeholder="e.g. main-entrance"
        className="mt-1.5"
      />
      <p className="mt-1 text-xs text-slate-400">
        Matches a checkpoint registered in Admin → Checkpoints (loads its profile).
      </p>

      <Button variant="outline" className="mt-4 w-full" onClick={() => setShowCamera(true)}>
        Configure camera…
      </Button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Device type">
          <Select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value as DeviceProfile['deviceType'])}
          >
            {deviceTypeSchema.options.map((o) => (
              <option key={o} value={o}>
                {DEVICE_TYPE_LABELS[o]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Scanner">
          <Select
            value={scannerSource}
            onChange={(e) => setScannerSource(e.target.value as DeviceProfile['scannerSource'])}
          >
            {scannerSourceSchema.options.map((o) => (
              <option key={o} value={o}>
                {SCANNER_SOURCE_LABELS[o]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Credential">
          <Select
            value={credentialMode}
            onChange={(e) => setCredentialMode(e.target.value as DeviceProfile['credentialMode'])}
          >
            {credentialModeSchema.options.map((o) => (
              <option key={o} value={o}>
                {CREDENTIAL_MODE_LABELS[o]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Printer">
          <Select
            value={printerTarget}
            onChange={(e) => setPrinterTarget(e.target.value as DeviceProfile['printerTarget'])}
          >
            {printerTargetSchema.options.map((o) => (
              <option key={o} value={o}>
                {PRINTER_TARGET_LABELS[o]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={nfcEnabled}
          onChange={(e) => setNfcEnabled(e.target.checked)}
          className="size-4 rounded border-slate-300"
        />
        Enable NFC (tap card / tag)
      </label>

      <div className="mt-6 flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
          Close
        </Button>
        <Button size="lg" className="flex-1" onClick={save}>
          {saved ? 'Saved ✓' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
