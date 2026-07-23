import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z, ZodError, type core } from 'zod';
import type { Context } from './context.ts';

/** Turn a Zod path segment into a "Field name" label (last segment, camelCase split). */
function fieldLabel(path: ReadonlyArray<PropertyKey>): string {
  const key = path[path.length - 1];
  if (key == null) return '';
  const label = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Collapse a ZodError into a short, human-readable sentence for the error `message`.
 * Zod v4's default message is a JSON dump of the issue array; without this the raw
 * `[{ "origin": "string", "code": "too_small", ... }]` blob leaks into client toasts.
 */
function humanizeZodError(err: ZodError): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const issue of err.issues as core.$ZodIssue[]) {
    const field = fieldLabel(issue.path);
    let msg: string;
    if (issue.code === 'too_small' && issue.minimum === 1) {
      msg = field ? `${field} is required` : 'Required';
    } else if (issue.code === 'invalid_type' && issue.input === undefined) {
      msg = field ? `${field} is required` : 'Required';
    } else if (issue.code === 'too_big' && issue.origin === 'string') {
      msg = `${field || 'Value'} is too long (max ${issue.maximum} characters)`;
    } else {
      msg = field ? `${field}: ${issue.message}` : issue.message;
    }
    if (!seen.has(msg)) {
      seen.add(msg);
      parts.push(msg);
    }
  }
  return parts.join('. ') || 'Invalid input';
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const zodError =
      error.code === 'BAD_REQUEST' && error.cause instanceof ZodError ? error.cause : null;
    return {
      ...shape,
      // Replace Zod's JSON-blob message with a readable one; leave other errors untouched.
      message: zodError ? humanizeZodError(zodError) : shape.message,
      data: {
        ...shape.data,
        // Field-level detail for clients that want per-input errors instead of the toast.
        zodError: zodError ? z.flattenError(zodError) : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

/** Requires an authenticated staff user (SRS FR-001). */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user, session: ctx.session } });
});
