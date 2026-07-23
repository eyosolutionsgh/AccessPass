import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { apiBase } from './api.ts';

const PROVIDER = (import.meta.env.VITE_REALTIME_PROVIDER as string | undefined) ?? 'socketio';
/** Fallback refresh cadence when no realtime transport is reachable (e.g. Ably not configured). */
const POLL_MS = 15_000;

/**
 * Subscribe to server visit events for live dashboards: lifecycle changes (check-in/out, pre-reg,
 * exceptions) AND live location updates. The handler is only ever a "refetch" — payloads are never
 * consumed — so every transport below reduces to "call handler() when something changed".
 *
 * Transport is chosen at build time by `VITE_REALTIME_PROVIDER`:
 *  - `socketio` (default, on-prem / dev): the in-process Socket.IO server.
 *  - `ably` (serverless demo): subscribe to Ably channels the session's token grants; if Ably can't
 *    be reached, degrade to interval polling so dashboards still refresh.
 */
export function useVisitEvents(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const fire = () => ref.current();
    if (PROVIDER === 'ably') return subscribeAbly(fire);
    return subscribeSocketIo(fire);
  }, []);
}

/** Current Socket.IO path (on-prem). `apiBase || undefined` keeps same-origin behaviour in dev. */
function subscribeSocketIo(fire: () => void): () => void {
  const socket = io(apiBase || undefined, { path: '/socket.io', withCredentials: true });
  socket.on('visit:event', fire);
  socket.on('visit:location', fire);
  return () => socket.disconnect();
}

/**
 * Ably path. Fetches a session-scoped token + the channel list from the API, subscribes, and calls
 * `fire` on any message. Falls back to polling if Ably isn't configured/reachable. Returns a
 * synchronous cleanup that tears down whichever transport ended up active.
 */
function subscribeAbly(fire: () => void): () => void {
  let cleanup: (() => void) | null = null;
  let cancelled = false;

  const startPolling = () => {
    const timer = setInterval(fire, POLL_MS);
    cleanup = () => clearInterval(timer);
  };

  void (async () => {
    try {
      const tokenUrl = `${apiBase}/api/realtime/token`;
      const res = await fetch(tokenUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`token endpoint ${res.status}`);
      // The endpoint returns a bare Ably TokenRequest (what `authUrl` expects). Its `capability`
      // is the channel→permissions map, so the channels we may subscribe to are its keys — no
      // separate endpoint needed.
      const tokenRequest = (await res.json()) as { capability: string };
      const channels = Object.keys(JSON.parse(tokenRequest.capability) as Record<string, unknown>);
      const Ably = await import('ably');
      // Same-origin authUrl → the browser sends the better-auth cookie automatically on re-auth.
      const rt = new Ably.Realtime({ authUrl: tokenUrl, authMethod: 'GET' });
      if (cancelled) {
        rt.close();
        return;
      }
      const subs = channels.map((name) => {
        const ch = rt.channels.get(name);
        void ch.subscribe(fire);
        return ch;
      });
      cleanup = () => {
        subs.forEach((ch) => ch.unsubscribe());
        rt.close();
      };
    } catch {
      // Ably unavailable (not configured, network, or unauthenticated) — keep dashboards fresh
      // with plain interval polling rather than going silent.
      if (!cancelled) startPolling();
    }
  })();

  return () => {
    cancelled = true;
    cleanup?.();
  };
}
