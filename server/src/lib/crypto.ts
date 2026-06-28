import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { customAlphabet } from 'nanoid';
import { INVITATION_CODE_ALPHABET, normalizeInvitationCode } from '@vms/shared';
import { env } from '../env.ts';

/**
 * Security primitives for the invitation flow (SRS §7.5).
 *  - Invitation codes use the confusable-free alphabet (FR-022 / QR-003).
 *  - QR tokens are opaque, cryptographically random, url-safe (QR-004 / QR-005).
 *  - Only HMAC hashes of codes/tokens are persisted (QR-SEC-05); validation re-hashes input.
 *  - Sensitive identifiers are AES-256-GCM encrypted at rest (§9.2).
 */

export function generateInvitationCode(size = 6): string {
  return customAlphabet(INVITATION_CODE_ALPHABET, size)();
}

/** Opaque, unguessable QR/badge token (≈256 bits). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Short, confusable-free, one-time code an admin reads out to pair a kiosk to its device id. */
export function generatePairingCode(size = 8): string {
  return customAlphabet(INVITATION_CODE_ALPHABET, size)();
}

/** HMAC of a pairing code, normalised the same way the redeem schema is (upper, no spaces/hyphens). */
export function hashPairingCode(code: string): string {
  const norm = code.trim().toUpperCase().replace(/[\s-]/g, '');
  return createHmac('sha256', env.QR_TOKEN_SECRET).update(norm).digest('hex');
}

/** HMAC-SHA256 of a normalised invitation code (case-insensitive, space/hyphen-insensitive). */
export function hashCode(code: string): string {
  return createHmac('sha256', env.QR_TOKEN_SECRET)
    .update(normalizeInvitationCode(code))
    .digest('hex');
}

/** HMAC-SHA256 of an exact token value. */
export function hashToken(token: string): string {
  return createHmac('sha256', env.QR_TOKEN_SECRET).update(token).digest('hex');
}

/** HMAC of a normalised value (trimmed, lowercased) for watchlist matching (SRS FR-072). */
export function hashMatch(value: string): string {
  return createHmac('sha256', env.QR_TOKEN_SECRET).update(value.trim().toLowerCase()).digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ── Field-level encryption (AES-256-GCM) ─────────────────────────────────────
const fieldKey = scryptSync(env.FIELD_ENCRYPTION_KEY, 'vms-field-encryption-v1', 32);

/** Encrypt a sensitive value → "iv:tag:ciphertext" (all base64). */
export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', fieldKey, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':');
}

export function decryptField(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted field');
  const decipher = createDecipheriv('aes-256-gcm', fieldKey, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
