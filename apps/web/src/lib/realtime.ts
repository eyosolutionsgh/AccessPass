import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Subscribe to server visit events for live dashboards: lifecycle changes (`visit:event` —
 * check-in/out, pre-reg, exceptions) AND live location updates (`visit:location` — the checkpoint
 * a visitor was just seen at). The handler ref keeps a single socket connection across re-renders.
 */
export function useVisitEvents(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    const fire = () => ref.current();
    socket.on('visit:event', fire);
    socket.on('visit:location', fire);
    return () => {
      socket.disconnect();
    };
  }, []);
}
