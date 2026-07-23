import { createServer } from 'node:http';
import { eq } from 'drizzle-orm';
import { anyRoleHasPermission, schema } from '@vms/shared';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.ts';
import { db } from './db.ts';
import { env } from './env.ts';
import {
  scheduleMaintenance,
  startMaintenanceWorker,
  stopMaintenance,
} from './jobs/maintenance.ts';
import { logger } from './logger.ts';
import { setIo } from './realtime.ts';
import { getSocketUser, type SocketUser } from './lib/socket-session.ts';
import { redis } from './redis.ts';

const app = createApp();

const server = createServer(app);

// Real-time channel for host arrival alerts, on-site list, security dashboard (SRS §5.4, FR-070/91).
export const io = new SocketIOServer(server, {
  cors: { origin: [env.WEB_ORIGIN, env.APP_URL], credentials: true },
});
setIo(io);

// Authenticate every socket from the better-auth session cookie in the handshake and reject
// anonymous connections. This closes the PII-broadcast hole: previously any client could connect
// and `join:host` any room, and visit events were emitted globally. Rooms are now joined SERVER-side
// from the session's permissions, so a client can never subscribe to data its role can't see.
io.use(async (socket, next) => {
  try {
    const user = await getSocketUser(socket.handshake.headers);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  } catch (err) {
    logger.debug({ err }, 'socket auth failed');
    next(new Error('unauthorized'));
  }
});

io.on('connection', async (socket) => {
  const user = socket.data.user as SocketUser;
  logger.debug({ socketId: socket.id, userId: user.id }, 'socket connected');

  // Live visit feed (`visit:event`) is scoped to staff with any dashboard permission.
  const dashboardActions = ['reception', 'security', 'host'] as const;
  if (dashboardActions.some((a) => anyRoleHasPermission(user.role, { dashboard: [a] }))) {
    socket.join('dashboard');
  }
  // Dedicated security room (incident + AI alerts) — security staff only.
  if (anyRoleHasPermission(user.role, { dashboard: ['security'] })) {
    socket.join('security');
  }
  // A host only ever joins their OWN arrival-alert room, derived from the session — not the client.
  const [host] = await db
    .select({ id: schema.host.id })
    .from(schema.host)
    .where(eq(schema.host.userId, user.id));
  if (host) socket.join(`host:${host.id}`);
});

server.listen(env.PORT, () => {
  logger.info(`VMS server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Background maintenance: credential/access expiry + overstay sweep (SRS FR-053/083).
startMaintenanceWorker();
void scheduleMaintenance();

let shuttingDown = false;
async function shutdown(reason: string, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ reason }, 'shutting down');
  server.close();
  await Promise.allSettled([stopMaintenance(), redis.quit(), db.$client.end()]);
  process.exit(code);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Last-resort funnels: anything that escapes Express/tRPC/job handlers lands here instead of
// vanishing (the job Sentry would do — kept on-prem with pino). An uncaught exception leaves the
// process in an undefined state, so log fatal and shut down for the supervisor to restart; a bare
// rejection is logged but survivable.
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  void shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection');
});
