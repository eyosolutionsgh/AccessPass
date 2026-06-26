import { TRPCError } from '@trpc/server';
import { anyRoleHasPermission, type PermissionRequest } from '@vms/shared';
import { rateLimit } from '../lib/ratelimit.ts';
import { protectedProcedure, publicProcedure } from './trpc.ts';

/** A procedure that requires the caller's role(s) to grant `request` (SRS FR-002). */
export function authorized(request: PermissionRequest) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = (ctx.user as { role?: string | null }).role ?? null;
    if (!anyRoleHasPermission(role, request)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }
    return next();
  });
}

/** A procedure granted if the caller satisfies ANY of the given permission requests. */
export function authorizedAny(...requests: PermissionRequest[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = (ctx.user as { role?: string | null }).role ?? null;
    if (!requests.some((r) => anyRoleHasPermission(role, r))) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    }
    return next();
  });
}

/**
 * A public (unauthenticated) procedure with per-IP rate limiting — for visitor self-service
 * check-in/pre-registration where the invitation token is the credential (SRS QR-SEC-01).
 */
export function rateLimited(limit: number, windowSeconds: number) {
  return publicProcedure.use(async ({ ctx, next }) => {
    const rl = await rateLimit(`ip:${ctx.ip}`, limit, windowSeconds);
    if (!rl.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many attempts. Please wait a moment and try again.',
      });
    }
    return next();
  });
}

/** Extract the audit/actor identity from the authenticated user. */
export function actorFrom(user: { id: string; role?: string | null }) {
  return { id: user.id, role: user.role ?? null };
}
