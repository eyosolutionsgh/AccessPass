import { Mic, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '../lib/trpc.ts';
import { Button } from './ui/button.tsx';

/** Base64-encode a buffer in chunks (avoids a call-stack overflow on large audio). */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/**
 * A1 voice input — record a short utterance and transcribe it with the on-prem Whisper (no cloud).
 * The transcript is handed back to the parent (e.g. to fill + run the copilot). Mic capture needs a
 * real device, so this is inert in headless environments.
 */
export function VoiceInputButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const transcribe = trpc.ai.transcribe.useMutation({
    onSuccess: (r) => (r.text ? onTranscript(r.text) : toast.error('No speech detected.')),
    onError: (e) => toast.error(e.message),
  });

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        transcribe.mutate({ audioBase64: toBase64(await blob.arrayBuffer()), mimeType: blob.type });
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error('Microphone not available.');
    }
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
  }

  return (
    <Button
      type="button"
      variant={recording ? 'destructive' : 'outline'}
      size="icon"
      loading={transcribe.isPending}
      onClick={recording ? stop : start}
      aria-label={recording ? 'Stop recording' : 'Speak your question'}
    >
      {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
    </Button>
  );
}
