import { trpc } from './trpc.ts';

/**
 * Plays the configured voice greeting ("Akwaaba" in Twi / "Welcome" in English) on a successful
 * check-in. The audio is prefetched on mount so it can play instantly inside the check-in success
 * handler. No-op when the on-prem TTS engine isn't configured or the browser blocks autoplay.
 */
export function useCheckinWelcome() {
  const welcome = trpc.checkin.welcome.useQuery(undefined, { retry: false, staleTime: Infinity });
  return () => {
    const w = welcome.data;
    if (!w?.audioBase64) return;
    try {
      const audio = new Audio(`data:${w.mimeType};base64,${w.audioBase64}`);
      void audio.play().catch(() => {});
    } catch {
      /* autoplay blocked or unsupported — ignore */
    }
  };
}
