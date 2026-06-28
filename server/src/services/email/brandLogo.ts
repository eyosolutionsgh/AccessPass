import { getLogo } from '../admin.ts';
import { COAT_OF_ARMS_CID, coatOfArmsPng } from './logo.ts';

/** Raster types email clients render inline; SVG/WebP are blocked or unsupported in most clients. */
const EMAIL_RASTER_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/**
 * The logo to embed (as a CID attachment) in outgoing emails. Prefers the admin-uploaded
 * institution logo when it's a raster format email clients can show inline (PNG/JPEG); an SVG/WebP
 * upload (which email clients block or won't render) or no upload at all falls back to the bundled
 * Ghana coat-of-arms PNG — so a branded email is always sent. The CID is always the same constant,
 * so templates can keep referencing `cid:vms-logo` unconditionally.
 */
export async function getEmailLogo(): Promise<{ filename: string; content: Buffer; cid: string }> {
  try {
    const logo = await getLogo();
    const ext = logo && EMAIL_RASTER_EXT[logo.mime];
    if (logo && ext) {
      return {
        filename: `logo.${ext}`,
        content: Buffer.from(logo.data, 'base64'),
        cid: COAT_OF_ARMS_CID,
      };
    }
  } catch {
    // Any lookup failure → bundled default; branding must never break email delivery.
  }
  return { filename: 'logo.png', content: coatOfArmsPng, cid: COAT_OF_ARMS_CID };
}
