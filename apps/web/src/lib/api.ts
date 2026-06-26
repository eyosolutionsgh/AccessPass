/**
 * Base URL of the VMS API (tRPC, REST, better-auth, Socket.io).
 *
 * Empty string = same-origin: in dev the Vite proxy forwards /trpc, /api and /socket.io to the
 * server, and a single-domain deploy serves both from one host. When the API is split onto its
 * own host (production: web at vms.3dt.com.gh, API at api.vms.3dt.com.gh) this is baked in at
 * build time via VITE_API_URL so the client targets the API origin directly (with credentials,
 * so the better-auth session cookie set on that host is sent back).
 */
export const apiBase = import.meta.env.VITE_API_URL ?? '';
