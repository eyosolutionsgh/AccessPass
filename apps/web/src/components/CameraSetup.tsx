import { BrowserCodeReader, BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getPreferredCameraId, setPreferredCameraId } from '../lib/camera.ts';
import { Button } from './ui/button.tsx';
import { Select } from './ui/select.tsx';

/** Friendly label for a camera, hinting front/back where the device exposes it. */
function cameraLabel(d: MediaDeviceInfo, i: number): string {
  const label = d.label || `Camera ${i + 1}`;
  if (/back|rear|environment/i.test(label)) return `${label} · rear`;
  if (/front|face|user/i.test(label)) return `${label} · front`;
  return label;
}

/**
 * Kiosk Camera setup — lists the device's cameras, previews the chosen one live, and decodes QR
 * codes in real time so the operator can confirm it works before saving the choice (persisted per
 * kiosk in localStorage; the check-in scanner then uses it). Requires HTTPS/localhost + permission.
 */
export function CameraSetup({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | undefined>(undefined);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState(getPreferredCameraId() ?? '');
  const [detected, setDetected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Enumerate cameras (this also prompts for permission so device labels are populated).
  useEffect(() => {
    BrowserCodeReader.listVideoInputDevices()
      .then((devices) => {
        setCameras(devices);
        setSelectedId((cur) => cur || devices[0]?.deviceId || '');
        if (devices.length === 0) setError('No camera found on this device.');
      })
      .catch(() =>
        setError('Could not access the camera — grant camera permission (HTTPS required).'),
      );
  }, []);

  // (Re)start live preview + decode whenever the selected camera changes.
  useEffect(() => {
    const el = videoRef.current;
    if (!selectedId || !el) return;
    let stopped = false;
    setDetected(null);
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
    reader
      .decodeFromVideoDevice(selectedId, el, (result) => {
        if (result && !stopped) setDetected(result.getText());
      })
      .then((c) => {
        controlsRef.current = c;
        if (stopped) c.stop();
      })
      .catch(() => setError('Could not start this camera. Try another one.'));
    return () => {
      stopped = true;
      controlsRef.current?.stop();
    };
  }, [selectedId]);

  function save() {
    setPreferredCameraId(selectedId || undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Camera setup</h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Choose this kiosk&apos;s camera and hold a QR code up to test it.
      </p>

      <div className="mt-5 text-left">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Camera
        </label>
        <Select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={cameras.length === 0}
        >
          {cameras.length === 0 && <option value="">No camera detected</option>}
          {cameras.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {cameraLabel(d, i)}
            </option>
          ))}
        </Select>
      </div>

      <div className="relative mx-auto mt-4 aspect-square w-full max-w-xs overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-200">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70" />
      </div>

      {detected ? (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <CheckCircle2 className="size-4" /> Test passed — QR detected
        </p>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{error ?? 'Waiting for a QR code…'}</p>
      )}

      <div className="mt-6 flex gap-3">
        <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
          <X className="size-4" /> Close
        </Button>
        <Button size="lg" className="flex-1" disabled={!selectedId} onClick={save}>
          {saved ? 'Saved ✓' : 'Save camera'}
        </Button>
      </div>
    </div>
  );
}
