import { describe, expect, it } from 'vitest';
import { ROLES, anyRoleHasPermission, hasPermission } from './permissions.ts';

describe('RBAC (SRS FR-002)', () => {
  it('lets hosts create appointments', () => {
    expect(hasPermission(ROLES.host, { appointment: ['create'] })).toBe(true);
  });

  it('forbids auditors from creating appointments (read-only)', () => {
    expect(hasPermission(ROLES.auditor, { appointment: ['create'] })).toBe(false);
    expect(hasPermission(ROLES.auditor, { appointment: ['read'] })).toBe(true);
  });

  it('grants the administrator every checked permission', () => {
    expect(
      hasPermission(ROLES.admin, { user: ['ban'], config: ['manage'], invitation: ['revoke'] }),
    ).toBe(true);
  });

  it('lets only security roles manage the watchlist', () => {
    expect(hasPermission(ROLES.securityManager, { watchlist: ['manage'] })).toBe(true);
    expect(hasPermission(ROLES.receptionist, { watchlist: ['manage'] })).toBe(false);
  });

  it('denies unknown roles', () => {
    expect(hasPermission('not_a_role', { appointment: ['read'] })).toBe(false);
  });

  it('checks comma-separated multi-role fields', () => {
    expect(anyRoleHasPermission('auditor,receptionist', { checkin: ['process'] })).toBe(true);
    expect(anyRoleHasPermission('auditor', { checkin: ['process'] })).toBe(false);
    expect(anyRoleHasPermission(null, { appointment: ['read'] })).toBe(false);
  });
});
