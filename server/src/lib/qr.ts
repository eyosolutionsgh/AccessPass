import QRCode from 'qrcode';

const OPTS = { margin: 1, width: 320, errorCorrectionLevel: 'M' as const };

/** PNG buffer — for inline email attachments (cid) and printed badges. */
export function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: 'png', ...OPTS });
}

/** data: URL — for rendering directly in web UI. */
export function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, OPTS);
}
