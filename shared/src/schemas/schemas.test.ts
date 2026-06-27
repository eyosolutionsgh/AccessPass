import { describe, expect, it } from 'vitest';
import {
  adminSetActiveSchema,
  checkInSubmitSchema,
  deviceLoginSchema,
  pointAssignSchema,
  pointCreateSchema,
  checkoutLookupSchema,
  directoryImportSchema,
  incidentCreateSchema,
  invitationCodeSchema,
  normalizeInvitationCode,
  preRegSubmitSchema,
  reprintSchema,
  userCreateSchema,
  watchlistAddSchema,
} from './index.ts';

describe('invitation code (SRS FR-022 / QR-003)', () => {
  it('normalizes whitespace/hyphens and uppercases', () => {
    expect(normalizeInvitationCode(' vx7-k9q ')).toBe('VX7K9Q');
  });

  it('accepts a valid code case-insensitively', () => {
    expect(invitationCodeSchema.parse('vx7k9q')).toBe('VX7K9Q');
  });

  it('rejects confusable characters (0, O, 1, I)', () => {
    expect(() => invitationCodeSchema.parse('VX7K0Q')).toThrow();
    expect(() => invitationCodeSchema.parse('VXIK9Q')).toThrow();
  });

  it('rejects codes outside the 6–10 length range', () => {
    expect(() => invitationCodeSchema.parse('VX7')).toThrow();
    expect(() => invitationCodeSchema.parse('VX7K9QVX7K9Q')).toThrow();
  });
});

describe('check-in submit input (SRS §7.3)', () => {
  it('accepts a manual-code lookup and normalises the code', () => {
    const parsed = checkInSubmitSchema.parse({ lookup: { kind: 'code', code: ' vx7k9q ' } });
    expect(parsed.lookup).toEqual({ kind: 'code', code: 'VX7K9Q' });
  });

  it('accepts a QR-token lookup', () => {
    const parsed = checkInSubmitSchema.parse({
      lookup: { kind: 'qr', token: 'a'.repeat(22) },
    });
    expect(parsed.lookup.kind).toBe('qr');
  });

  it('rejects a too-short QR token', () => {
    expect(() => checkInSubmitSchema.parse({ lookup: { kind: 'qr', token: 'short' } })).toThrow();
  });
});

describe('pre-registration submit input', () => {
  it('defaults fields and acknowledgements to empty objects', () => {
    const parsed = preRegSubmitSchema.parse({ token: 'a'.repeat(20) });
    expect(parsed.fields).toEqual({});
    expect(parsed.acknowledgements).toEqual({});
  });

  it('allows an empty-string email but rejects a malformed one', () => {
    expect(preRegSubmitSchema.parse({ token: 'a'.repeat(20), visitorEmail: '' }).visitorEmail).toBe(
      '',
    );
    expect(() =>
      preRegSubmitSchema.parse({ token: 'a'.repeat(20), visitorEmail: 'nope' }),
    ).toThrow();
  });
});

describe('check-out + reprint inputs (SRS FR-080 / FR-054)', () => {
  it('accepts code and badge check-out lookups', () => {
    expect(checkoutLookupSchema.parse({ kind: 'code', code: 'vx7k9q' })).toEqual({
      kind: 'code',
      code: 'VX7K9Q',
    });
    expect(checkoutLookupSchema.parse({ kind: 'badge', token: 'b'.repeat(20) }).kind).toBe('badge');
  });

  it('requires a non-empty reprint reason', () => {
    expect(reprintSchema.parse({ visitId: crypto.randomUUID(), reason: 'jam' }).reason).toBe('jam');
    expect(() => reprintSchema.parse({ visitId: crypto.randomUUID(), reason: '' })).toThrow();
  });
});

describe('security inputs (SRS FR-072/093)', () => {
  it('validates watchlist match types and rejects others', () => {
    expect(watchlistAddSchema.parse({ matchType: 'email', value: 'x@y.test' }).matchType).toBe(
      'email',
    );
    expect(() => watchlistAddSchema.parse({ matchType: 'fingerprint', value: 'x' })).toThrow();
  });

  it('defaults incident severity to low and requires a description', () => {
    expect(incidentCreateSchema.parse({ type: 'other', description: 'note' }).severity).toBe('low');
    expect(() => incidentCreateSchema.parse({ type: 'other', description: '' })).toThrow();
  });
});

describe('admin inputs (SRS §6.11, §10.4)', () => {
  it('validates staff role against the known role set', () => {
    expect(
      userCreateSchema.parse({
        name: 'Reception One',
        email: 'r1@vms.local',
        role: 'receptionist',
      }).role,
    ).toBe('receptionist');
    expect(() => userCreateSchema.parse({ name: 'X', email: 'x@y.z', role: 'wizard' })).toThrow();
  });

  it('requires at least one host in a directory import', () => {
    expect(
      directoryImportSchema.parse({ hosts: [{ name: 'A', email: 'a@vms.local' }] }).hosts,
    ).toHaveLength(1);
    expect(() => directoryImportSchema.parse({ hosts: [] })).toThrow();
  });

  it('soft-delete toggle requires a uuid id and boolean flag', () => {
    const id = crypto.randomUUID();
    expect(adminSetActiveSchema.parse({ id, isActive: false })).toEqual({ id, isActive: false });
    expect(() => adminSetActiveSchema.parse({ id: 'not-a-uuid', isActive: true })).toThrow();
    expect(() => adminSetActiveSchema.parse({ id })).toThrow();
  });

  it('point create defaults kind to checkpoint and validates the kind enum', () => {
    expect(pointCreateSchema.parse({ name: 'Main Reception' }).kind).toBe('checkpoint');
    expect(pointCreateSchema.parse({ name: 'Gate 2', kind: 'security' }).kind).toBe('security');
    expect(() => pointCreateSchema.parse({ name: 'X', kind: 'lobby' })).toThrow();
    expect(() => pointCreateSchema.parse({ name: '' })).toThrow();
  });

  it('point assignment takes a point id + a list of user ids', () => {
    const pointId = crypto.randomUUID();
    expect(pointAssignSchema.parse({ pointId, userIds: ['u1', 'u2'] }).userIds).toHaveLength(2);
    expect(pointAssignSchema.parse({ pointId, userIds: [] }).userIds).toHaveLength(0);
    expect(() => pointAssignSchema.parse({ pointId: 'nope', userIds: [] })).toThrow();
  });

  it('device login requires a device id', () => {
    expect(deviceLoginSchema.parse({ deviceId: 'lobby-1' }).deviceId).toBe('lobby-1');
    expect(() => deviceLoginSchema.parse({ deviceId: '' })).toThrow();
  });
});
