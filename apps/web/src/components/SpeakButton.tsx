import { Volume2, VolumeX } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc.ts';
import { Button } from './ui/button.tsx';

/**
 * A1 voice output — read an AI answer aloud via the on-prem Piper TTS (no cloud). The synthesized
 * MP3 is returned inline and played in the browser; clicking again while it plays stops it.
 */
export function SpeakButton({ text }: { text: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const speak = trpc.ai.speak.useMutation({
    onSuccess: ({ audioBase64, mimeType }) => {
      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      setPlaying(true);
      void audio.play().catch(() => setPlaying(false));
    },
    onError: (e) => toast.error(e.message),
  });

  function toggle() {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    speak.mutate({ text });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      loading={speak.isPending}
      onClick={toggle}
      aria-label={playing ? 'Stop reading' : 'Read answer aloud'}
      title={playing ? 'Stop reading' : 'Read answer aloud'}
    >
      {playing ? (
        <VolumeX className="size-4 text-brand-600" />
      ) : (
        <Volume2 className="size-4 text-slate-500" />
      )}
    </Button>
  );
}
