/**
 * A1 (voice input) — speech-to-text via a local OpenAI-compatible Whisper server (faster-whisper).
 * Air-gapped: audio goes only to the on-prem STT service, never a cloud transcriber. Disabled when
 * AI_STT_URL is unset.
 */
import { env } from '../../env.ts';
import { AiUnavailableError } from './client.ts';

export function isSttEnabled(): boolean {
  return Boolean(env.AI_STT_URL);
}

/** Transcribe an audio clip to text (OpenAI `/v1/audio/transcriptions`, multipart). */
export async function transcribe(audio: Uint8Array, mimeType: string): Promise<string> {
  if (!env.AI_STT_URL) throw new AiUnavailableError('Speech-to-text runtime is not configured');
  const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('mp4') ? 'mp4' : 'webm';
  const form = new FormData();
  // Re-wrap into a plain Uint8Array so the Blob part is valid under both Node and DOM lib typings
  // (the web typechecks this module via the AppRouter type import).
  form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), `audio.${ext}`);
  form.append('model', env.AI_STT_MODEL);
  form.append('response_format', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.AI_STT_URL}/audio/transcriptions`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`STT endpoint ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as { text?: string };
    return (data.text ?? '').trim();
  } finally {
    clearTimeout(timer);
  }
}
