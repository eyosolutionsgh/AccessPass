import type { Server as SocketIOServer } from 'socket.io';
import { isAblyEnabled, publishAblyPoke } from './lib/ably.ts';

/**
 * Thin indirection so services can emit real-time events without importing the HTTP server
 * (avoids a circular import). `index.ts` calls `setIo(io)` at startup (on-prem Socket.IO path).
 *
 * Two backends, selected by `REALTIME_PROVIDER`:
 *  - `socketio` (default, on-prem): emit the named event + payload to a scoped room.
 *  - `ably` (serverless demo): publish a contentless poke to the matching channel; the client
 *    treats any message as "refetch". No payload/PII crosses Ably (see lib/ably.ts).
 *
 * Events power the security/reception dashboards and host arrival alerts (SRS §5.4, FR-070/91).
 */
let io: SocketIOServer | null = null;

export function setIo(server: SocketIOServer): void {
  io = server;
}

/**
 * Deliver one event to one room/channel. On Ably the event name/payload collapse to a poke (the
 * client refetches regardless of type); on Socket.IO the exact event + payload are emitted as before.
 */
function deliver(room: string, event: string, payload: { at: string }): void {
  if (isAblyEnabled()) {
    publishAblyPoke(room, payload.at);
    return;
  }
  io?.to(room).emit(event, payload);
}

export type VisitEvent = {
  type: 'checked_in' | 'checked_out' | 'pre_registered' | 'exception';
  visitId: string;
  facilityId?: string;
  visitorName?: string;
  hostName?: string;
  at: string;
};

/**
 * Emit a visit lifecycle event to the staff `dashboard` room (joined server-side from the session's
 * dashboard permission — see index.ts). Scoped, NOT global: the event carries visitor/host names,
 * so it must never reach an unauthenticated or non-dashboard socket.
 */
export function emitVisitEvent(event: VisitEvent): void {
  deliver('dashboard', 'visit:event', event);
}

/** Notify a specific host of their visitor's arrival (the host joins their own room server-side). */
export function emitHostAlert(hostId: string, event: VisitEvent): void {
  deliver(`host:${hostId}`, 'host:alert', event);
}

/** Emit a security event to the `security` room (security staff only). */
export function emitSecurityAlert(event: VisitEvent): void {
  deliver('security', 'security:alert', event);
}

export type VisitLocationEvent = {
  visitId: string;
  hostId?: string | null;
  facilityId?: string | null;
  visitorName?: string | null;
  /** Checkpoint the visitor was just seen at (device label), e.g. "Lobby", "1st Reception". */
  checkpoint?: string | null;
  /** check_in | passage | check_out. */
  kind: string;
  at: string;
};

/**
 * Broadcast a visitor's live location (the checkpoint they were just seen at) so a host can track
 * where their visitor is at any moment. Goes to the staff `dashboard` room AND the specific host's
 * room — never global, since it carries the visitor name.
 */
export function emitVisitLocation(event: VisitLocationEvent): void {
  deliver('dashboard', 'visit:location', event);
  if (event.hostId) deliver(`host:${event.hostId}`, 'visit:location', event);
}

export type AiAlert = { kind: string; message: string; visitId?: string; at: string };

/**
 * Room-scoped seam for AI-generated alerts (analyst summaries, risk flags). Defaults to the
 * `security` room; never global. Any future AI emit MUST go through a scoped helper like this.
 */
export function emitAiAlert(event: AiAlert, room = 'security'): void {
  deliver(room, 'ai:alert', event);
}
