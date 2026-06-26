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

  it('grants the administrator identity, config and read-only oversight', () => {
    expect(hasPermission(ROLES.admin, { user: ['ban', 'set-role', 'create'] })).toBe(true);
    expect(hasPermission(ROLES.admin, { config: ['manage'] })).toBe(true);
    expect(hasPermission(ROLES.admin, { appointment: ['read'], audit: ['read'] })).toBe(true);
    expect(hasPermission(ROLES.admin, { report: ['read'] })).toBe(true);
    // Security dashboard for oversight, but NOT the reception front-desk console.
    expect(hasPermission(ROLES.admin, { dashboard: ['security'] })).toBe(true);
    expect(hasPermission(ROLES.admin, { dashboard: ['reception'] })).toBe(false);
  });

  it('keeps the administrator out of front-line operations (least privilege)', () => {
    expect(hasPermission(ROLES.admin, { checkin: ['process'] })).toBe(false);
    expect(hasPermission(ROLES.admin, { badge: ['issue'] })).toBe(false);
    expect(hasPermission(ROLES.admin, { badge: ['reprint'] })).toBe(false);
    expect(hasPermission(ROLES.admin, { appointment: ['create'] })).toBe(false);
    expect(hasPermission(ROLES.admin, { invitation: ['revoke'] })).toBe(false);
    expect(hasPermission(ROLES.admin, { watchlist: ['manage'] })).toBe(false);
    expect(hasPermission(ROLES.admin, { report: ['export'] })).toBe(false);
  });

  it('lets only security roles manage the watchlist', () => {
    expect(hasPermission(ROLES.securityManager, { watchlist: ['manage'] })).toBe(true);
    expect(hasPermission(ROLES.receptionist, { watchlist: ['manage'] })).toBe(false);
  });

  it('forbids receptionists from creating users or running the security checkpoint', () => {
    expect(hasPermission(ROLES.receptionist, { user: ['create'] })).toBe(false);
    expect(hasPermission(ROLES.receptionist, { checkin: ['override'] })).toBe(false);
    // …but they still operate the check-in and check-out desks.
    expect(hasPermission(ROLES.receptionist, { checkin: ['process'] })).toBe(true);
    expect(hasPermission(ROLES.receptionist, { checkin: ['checkout'] })).toBe(true);
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
