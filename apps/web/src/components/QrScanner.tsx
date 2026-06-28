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
        setError(
          'Camera unavailable — grant camera access (HTTPS required) or enter your code below.',
        ),
      );
    return () => {
      done = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Scan your QR code</h1>
      <div className="relative mx-auto mt-6 aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-slate-900 ring-1 ring-slate-200">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        {/* Viewfinder: dimmed surround + bright corner brackets so visitors know where to aim. */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-8 rounded-2xl shadow-[0_0_0_100vmax_rgba(15,23,42,0.45)]" />
          <div className="absolute left-8 top-8 size-9 rounded-tl-2xl border-l-4 border-t-4 border-white/90" />
          <div className="absolute right-8 top-8 size-9 rounded-tr-2xl border-r-4 border-t-4 border-white/90" />
          <div className="absolute bottom-8 left-8 size-9 rounded-bl-2xl border-b-4 border-l-4 border-white/90" />
          <div className="absolute bottom-8 right-8 size-9 rounded-br-2xl border-b-4 border-r-4 border-white/90" />
        </div>
      </div>
      <p className="mt-5 text-base text-slate-600">
        {error ?? 'Hold your invitation QR code up to the camera.'}
      </p>
      <Button variant="outline" size="lg" className="mt-6 h-14 w-full text-base" onClick={onCancel}>
        <X className="size-5" /> Cancel
      </Button>
    </div>
  );
}
