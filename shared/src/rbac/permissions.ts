/**
 * Role-based access control — the single source of truth for the SRS's 7 user classes
 * (§3.2). Built on better-auth's access-control primitives so the SAME `ac` + roles drive
 * both the server (admin/organization plugins) and the client (adminClient/organizationClient).
 *
 * SRS FR-002: each role can access only its authorized functions.
 */
import { createAccessControl } from 'better-auth/plugins/access';

/**
 * Resources and the actions permitted on them. Keep action verbs stable — they are referenced
 * by middleware and UI permission checks.
 */
export const statement = {
  appointment: ['create', 'read', 'update', 'cancel', 'approve', 'deny'],
  invitation: ['create', 'resend', 'revoke', 'regenerate', 'read'],
  checkin: ['process', 'self', 'override', 'checkout', 'bulk_checkout'],
  badge: ['issue', 'reprint', 'read'],
  visitor: ['create', 'read', 'update', 'delete'],
  watchlist: ['read', 'manage'],
  access: ['assign', 'revoke', 'read'],
  incident: ['create', 'read', 'resolve'],
  dashboard: ['reception', 'security', 'host'],
  report: ['read', 'export'],
  audit: ['read', 'export'],
  // AI analyst (A4) + operations copilot (A2). `read` = analyst summaries/audit-Q&A/similar;
  // `suggest` = classification; `operations` = the copilot over live visit/on-site data.
  analyst: ['read', 'suggest', 'operations'],
  // Staff/admin management — mirrors the better-auth admin plugin surface. The verbs must
  // match the ones the admin plugin checks internally: `list` gates listUsers, `set-role`
  // gates setRole, `ban` gates ban/unban, `update` gates adminUpdateUser, and changing the
  // email field additionally requires `set-email`. Omitting a verb makes that operation throw
  // "You are not allowed to …" even for an administrator.
  user: ['create', 'read', 'list', 'update', 'set-email', 'delete', 'ban', 'set-role'],
  // Facility, categories, templates, retention, integrations (SRS §6.11).
  config: ['read', 'manage'],
} as const;

export const ac = createAccessControl(statement);

/** SRS §3.2 user classes → role names. Use these constants everywhere (no string literals). */
export const ROLES = {
  visitor: 'visitor',
  host: 'host',
  receptionist: 'receptionist',
  // Personal assistant who books only for the officer(s) in their OWN office (scope enforced
  // server-side from the secretary's own host.officeId — see server/src/services/scope.ts).
  secretary: 'secretary',
  securityGuard: 'security_guard',
  securityManager: 'security_manager',
  admin: 'system_administrator',
  auditor: 'auditor',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/** Literal tuple of role names (preserves literal types for zod enums / better-auth). */
export const ROLE_VALUES = [
  ROLES.visitor,
  ROLES.host,
  ROLES.receptionist,
  ROLES.securityGuard,
  ROLES.securityManager,
  ROLES.admin,
  ROLES.auditor,
  // Appended (not inserted) so existing positional indices stay stable.
  ROLES.secretary,
] as const;

export const visitor = ac.newRole({
  checkin: ['self'],
  invitation: ['read'],
});

export const host = ac.newRole({
  appointment: ['create', 'read', 'update', 'cancel', 'approve'],
  invitation: ['create', 'resend', 'revoke', 'regenerate', 'read'],
  visitor: ['create', 'read'],
  dashboard: ['host'],
});

export const receptionist = ac.newRole({
  appointment: ['create', 'read', 'update'],
  invitation: ['read', 'resend'],
  // Front desk operates the check-in and check-out posts only. The checkpoint scan
  // (`override`, gating guardScan / the /checkpoint post) is a security-guard function,
  // so it is deliberately withheld from reception.
  checkin: ['process', 'checkout'],
  badge: ['issue', 'reprint', 'read'],
  visitor: ['create', 'read', 'update'],
  incident: ['create', 'read'],
  dashboard: ['reception'],
  analyst: ['operations'],
});

export const secretary = ac.newRole({
  // Books/reschedules for officers in their own office. No cancel/approve/deny.
  appointment: ['create', 'read', 'update'],
  invitation: ['read', 'resend'],
  visitor: ['create', 'read'],
});

export const securityGuard = ac.newRole({
  appointment: ['read', 'deny'],
  checkin: ['override', 'checkout', 'bulk_checkout'],
  badge: ['read'],
  visitor: ['read'],
  watchlist: ['read'],
  access: ['read'],
  incident: ['create', 'read', 'resolve'],
  dashboard: ['security'],
  analyst: ['read', 'operations'],
});

export const securityManager = ac.newRole({
  appointment: ['read', 'approve', 'deny'],
  checkin: ['override', 'checkout', 'bulk_checkout'],
  badge: ['read'],
  visitor: ['read', 'update'],
  watchlist: ['read', 'manage'],
  access: ['assign', 'revoke', 'read'],
  incident: ['create', 'read', 'resolve'],
  dashboard: ['security'],
  report: ['read', 'export'],
  audit: ['read'],
  config: ['read'],
  analyst: ['read', 'suggest', 'operations'],
});

// Identity & system administration + read-only oversight — NOT a super-user. The administrator
// manages accounts and system configuration and can see operational data, reports and the audit
// trail for oversight, but performs no front-line work: no check-in/checkout/checkpoint, badge
// issuing, booking/approving appointments, watchlist/access management or incident handling.
// Those belong to reception and security roles (SRS FR-002, least privilege).
export const systemAdministrator = ac.newRole({
  // Staff/account management (mirrors the better-auth admin plugin verbs).
  user: ['create', 'read', 'list', 'update', 'set-email', 'delete', 'ban', 'set-role'],
  // Facilities, categories, templates, retention, integrations.
  config: ['read', 'manage'],
  // Read-only oversight. Reception is a pure front-desk console (no oversight value for an
  // administrator), so admin gets the security dashboard only — not reception.
  appointment: ['read'],
  visitor: ['read'],
  dashboard: ['security'],
  report: ['read'],
  audit: ['read'],
});

export const auditor = ac.newRole({
  appointment: ['read'],
  visitor: ['read'],
  report: ['read', 'export'],
  audit: ['read', 'export'],
  analyst: ['read'],
});

/** Map of role-name → role definition, for passing to the better-auth plugins. */
export const roles = {
  [ROLES.visitor]: visitor,
  [ROLES.host]: host,
  [ROLES.receptionist]: receptionist,
  [ROLES.secretary]: secretary,
  [ROLES.securityGuard]: securityGuard,
  [ROLES.securityManager]: securityManager,
  [ROLES.admin]: systemAdministrator,
  [ROLES.auditor]: auditor,
} as const;

export type ResourceName = keyof typeof statement;
/** A permission request, e.g. `{ appointment: ['create'], invitation: ['read'] }`. */
export type PermissionRequest = {
  [K in ResourceName]?: (typeof statement)[K][number][];
};

/** True if `roleName` is granted every action in `request`. Unknown roles are denied. */
export function hasPermission(roleName: string, request: PermissionRequest): boolean {
  const role = roles[roleName as RoleName];
  if (!role) return false;
  return role.authorize(request as never).success;
}

/**
 * True if ANY of the user's roles satisfies `request`. better-auth stores roles as a
 * comma-separated string (admin plugin), so we split and check each.
 */
export function anyRoleHasPermission(
  roleField: string | null | undefined,
  request: PermissionRequest,
): boolean {
  if (!roleField) return false;
  return roleField
    .split(',')
    .map((r) => r.trim())
    .some((r) => hasPermission(r, request));
}
