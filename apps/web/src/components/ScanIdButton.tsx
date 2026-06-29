import { Camera, ScanLine, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { getPreferredCameraId } from '../lib/camera.ts';
import { trpc } from '../lib/trpc.ts';
import { Button } from './ui/button.tsx';
import { Modal } from './ui/modal.tsx';

export type ExtractedId = {
  fullName: string | null;
  dateOfBirth: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  expiryDate: string | null;
};

/** Downscale (max 1600px) + JPEG-encode a drawable source → keeps the upload small and OCR-friendly. */
function drawToJpegBase64(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxDim = 1600,
): string {
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas context');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';
}

async function fileToJpegBase64(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  return drawToJpegBase64(img, img.width, img.height);
}

const TOOLTIP =
  "Photograph or upload the visitor's ID to auto-fill their name and details. Read on-site by the local AI — the image is never uploaded to the cloud or stored.";

/**
 * "Scan ID" — opens the device camera to capture an ID document (or upload a photo), extracts the
 * fields via the on-prem vision model (B1), and hands them back to the parent to auto-fill. The
 * image is processed locally and isn't stored. Live camera works on any secure context (HTTPS or
 * localhost); the file picker is always offered as a fallback.
 */
export function ScanIdButton({ onResult }: { onResult: (fields: ExtractedId) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const extract = trpc.ai.extractId.useMutation({
    onSuccess: (fields) => {
      onResult(fields);
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image of the ID document.');
      return;
    }
    try {
      const imageBase64 = await fileToJpegBase64(file);
      extract.mutate({ imageBase64, mimeType: 'image/jpeg' });
    } catch {
      toast.error('Could not read that image.');
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        tooltip={TOOLTIP}
        tooltipSide="left"
        onClick={() => setOpen(true)}
      >
        <ScanLine className="size-4" /> Scan ID
      </Button>
      {open && (
        <CaptureModal
          busy={extract.isPending}
          onClose={() => setOpen(false)}
          onCapture={(imageBase64) => extract.mutate({ imageBase64, mimeType: 'image/jpeg' })}
          onPickFile={() => fileRef.current?.click()}
        />
      )}
    </>
  );
}

/**
 * Live-camera capture dialog. Streams the device camera via getUserMedia (preferring the kiosk's
 * configured camera, else the rear/environment one), shows an ID-card guide, and snaps a still on
 * Capture. Falls back to file upload if the camera can't start (no permission / not HTTPS / none).
 */
function CaptureModal({
  busy,
  onClose,
  onCapture,
  onPickFile,
}: {
  busy: boolean;
  onClose: () => void;
  onCapture: (imageBase64: string) => void;
  onPickFile: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const preferred = getPreferredCameraId();
        stream = await navigator.mediaDevices.getUserMedia({
          video: preferred ? { deviceId: { exact: preferred } } : { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
          setReady(true);
        }
      } catch {
        setError(
          'Camera unavailable — allow camera access (HTTPS required), or upload a photo instead.',
        );
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const el = videoRef.current;
    if (!el || !el.videoWidth) return;
    try {
      onCapture(drawToJpegBase64(el, el.videoWidth, el.videoHeight));
    } catch {
      toast.error('Could not capture the image — try uploading a photo instead.');
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={<Camera />}
      title="Scan ID document"
      description="Hold the ID inside the frame, then capture. The image is read on-site and not stored."
      className="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onPickFile} disabled={busy}>
            <Upload className="size-4" /> Upload a photo
          </Button>
          <Button onClick={capture} loading={busy} disabled={!ready || Boolean(error)}>
            <Camera className="size-4" /> Capture
          </Button>
        </>
      }
    >
      <div className="relative mx-auto aspect-[1.586] w-full overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-200">
        <video ref={videoRef} className="size-full object-cover" muted playsInline />
        {/* ID-card guide so staff know how to frame the document. */}
        <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-white/70" />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/85 p-6 text-center text-sm text-white">
            {error}
          </div>
        )}
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            Starting camera…
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Fill the frame with the card, avoid glare, and keep the text in focus for the best read.
      </p>
    </Modal>
  );
}
