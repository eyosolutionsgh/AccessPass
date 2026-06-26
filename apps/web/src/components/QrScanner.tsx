import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getPreferredCameraId } from '../lib/camera.ts';
import { Button } from './ui/button.tsx';

/**
 * Camera QR scanner — opens the device camera via getUserMedia and decodes QR codes locally with
 * @zxing/browser (on-device, no cloud — air-gap safe). Calls `onResult` with the decoded text on the
 * first successful scan. Requires a secure context (HTTPS or localhost) and camera permission;
 * degrades gracefully (shows a message) when the camera is unavailable.
 */
export function QrScanner({
  onResult,
  onCancel,
}: {
  onResult: (text: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let done = false;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
    const el = videoRef.current;
    if (!el) return;
    // Use the kiosk's configured camera (Camera setup); undefined = auto-select the rear camera.
    reader
      .decodeFromVideoDevice(getPreferredCameraId(), el, (result, _err, ctrl) => {
        if (result && !done) {
          done = true;
          ctrl.stop();
          onResultRef.current(result.getText());
        }
      })
      .then((c) => {
        controls = c;
        if (done) c.stop();
      })
      .catch(() =>
        setError('Camera unavailable — grant camera access (HTTPS required) or enter your code below.'),
      );
    return () => {
      done = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Scan your QR code</h1>
      <div className="relative mx-auto mt-6 aspect-square w-full max-w-xs overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-slate-200">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-white/70" />
      </div>
      <p className="mt-4 text-sm text-slate-600">
        {error ?? 'Hold your invitation QR code up to the camera.'}
      </p>
      <Button variant="outline" size="lg" className="mt-6" onClick={onCancel}>
        <X className="size-4" /> Cancel
      </Button>
    </div>
  );
}
