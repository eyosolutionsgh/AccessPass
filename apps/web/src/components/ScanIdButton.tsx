import { ScanLine } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc.ts';
import { Button } from './ui/button.tsx';

export type ExtractedId = {
  fullName: string | null;
  dateOfBirth: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  expiryDate: string | null;
};

/** Downscale (max 1600px) + JPEG-encode in the browser → keeps the upload small and OCR-friendly. */
async function fileToJpegBase64(file: File, maxDim = 1600): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas context');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';
}

/**
 * "Scan ID" — capture/upload an ID photo, extract fields via the on-prem vision model (B1), and
 * hand them back to the parent to auto-fill. The image never leaves the facility and isn't stored.
 */
export function ScanIdButton({ onResult }: { onResult: (fields: ExtractedId) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const extract = trpc.ai.extractId.useMutation({
    onSuccess: onResult,
    onError: (e) => toast.error(e.message),
  });

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        loading={extract.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <ScanLine className="size-4" /> Scan ID
      </Button>
    </>
  );
}
