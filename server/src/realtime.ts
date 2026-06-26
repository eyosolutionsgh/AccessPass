import type { Server as SocketIOServer } from 'socket.io';

/**
 * Thin indirection so services can emit real-time events without importing the HTTP server
 * (avoids a circular import). `index.ts` calls `setIo(io)` at startup.
 *
 * Events power the security/reception dashboards and host arrival alerts (SRS §5.4, FR-070/91).
 */
let io: SocketIOServer | null = null;

export function setIo(server: SocketIOServer): void {
  io = server;
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
  io?.to('dashboard').emit('visit:event', event);
}

/** Notify a specific host of their visitor's arrival (the host joins their own room server-side). */
export function emitHostAlert(hostId: string, event: VisitEvent): void {
  io?.to(`host:${hostId}`).emit('host:alert', event);
}

/** Emit a security event to the `security` room (security staff only). */
export function emitSecurityAlert(event: VisitEvent): void {
  io?.to('security').emit('security:alert', event);
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
  io?.to('dashboard').emit('visit:location', event);
  if (event.hostId) io?.to(`host:${event.hostId}`).emit('visit:location', event);
}

export type AiAlert = { kind: string; message: string; visitId?: string; at: string };

/**
 * Room-scoped seam for AI-generated alerts (analyst summaries, risk flags). Defaults to the
 * `security` room; never global. Any future AI emit MUST go through a scoped helper like this.
 */
export function emitAiAlert(event: AiAlert, room = 'security'): void {
  io?.to(room).emit('ai:alert', event);
}
