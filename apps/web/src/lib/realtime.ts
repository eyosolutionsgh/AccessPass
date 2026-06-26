import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { apiBase } from './api.ts';

/**
 * Subscribe to server visit events for live dashboards: lifecycle changes (`visit:event` —
 * check-in/out, pre-reg, exceptions) AND live location updates (`visit:location` — the checkpoint
 * a visitor was just seen at). The handler ref keeps a single socket connection across re-renders.
 */
export function useVisitEvents(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    // `apiBase || undefined` keeps same-origin behaviour in dev; when the API is on its own host
    // (api.vms.3dt.com.gh) connect there with credentials so the session cookie is sent.
    const socket = io(apiBase || undefined, { path: '/socket.io', withCredentials: true });
    const fire = () => ref.current();
    socket.on('visit:event', fire);
    socket.on('visit:location', fire);
    return () => {
      socket.disconnect();
    };
  }, []);
}
