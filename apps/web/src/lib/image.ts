/**
 * Client-side image downscale + compress for visitor-uploaded identity images (selfie / ID).
 * Phones produce multi-megabyte photos; we cap the longest edge and re-encode to JPEG so the
 * upload stays small and the server's size guard is comfortably met. Runs entirely in the browser
 * (canvas) — no bytes leave the device until the resulting data URL is sent.
 */

/** Longest-edge cap (px) — plenty for a legible selfie/ID thumbnail and OCR-grade detail. */
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;

/** Load a File into an HTMLImageElement via an object URL, revoking it once decoded. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image. Please try another file.'));
    };
    img.src = url;
  });
}

/**
 * Downscale `file` so its longest edge is at most {@link MAX_EDGE} and return a JPEG `data:` URL.
 * Images already within bounds are still re-encoded to JPEG to normalise the format/size.
 */
export async function compressImageToDataUrl(file: File): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing is not supported on this device.');
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
