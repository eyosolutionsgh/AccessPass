import { describe, expect, it } from 'vitest';
import { INVITATION_CODE_ALPHABET } from '@vms/shared';
import {
  decryptField,
  encryptField,
  generateInvitationCode,
  generateToken,
  hashCode,
  safeEqualHex,
} from './crypto.ts';

describe('invitation code generation', () => {
  it('uses only the confusable-free alphabet and requested length', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInvitationCode(6);
      expect(code).toHaveLength(6);
      expect([...code].every((c) => INVITATION_CODE_ALPHABET.includes(c))).toBe(true);
      expect(code).not.toMatch(/[O0I1]/);
    }
  });
});

describe('hashCode (SRS QR-SEC-05)', () => {
  it('is deterministic and case/space-insensitive', () => {
    expect(hashCode('VX7K9Q')).toBe(hashCode(' vx7-k9q '));
  });
  it('differs for different codes', () => {
    expect(hashCode('VX7K9Q')).not.toBe(hashCode('VX7K9R'));
  });
  it('produces a 64-char hex digest', () => {
    expect(hashCode('VX7K9Q')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('tokens', () => {
  it('generates unguessable url-safe tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('field encryption (AES-256-GCM)', () => {
  it('round-trips a value', () => {
    const secret = 'GHA-PASSPORT-G1234567';
    const enc = encryptField(secret);
    expect(enc).not.toContain(secret);
    expect(decryptField(enc)).toBe(secret);
  });
  it('produces different ciphertext each time (random IV)', () => {
    expect(encryptField('x')).not.toBe(encryptField('x'));
  });
});

describe('safeEqualHex', () => {
  it('matches equal digests and rejects others', () => {
    const h = hashCode('ABC234');
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, hashCode('ABC235'))).toBe(false);
  });
});
