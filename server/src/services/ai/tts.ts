/**
 * A1 (voice output) — text-to-speech via local OpenAI-compatible servers. Air-gapped: text goes
 * only to an on-prem TTS engine, never a cloud synthesizer. English (the named voices) is served by
 * Piper at AI_TTS_URL; Twi/Akan by the Meta MMS engine at AI_TTS_AKAN_URL. Disabled when unset.
 */
import { env } from '../../env.ts';
import { AiUnavailableError } from './client.ts';

export function isTtsEnabled(): boolean {
  return Boolean(env.AI_TTS_URL);
}

/** Whether the Twi/Akan voice engine (Meta MMS) is configured. */
export function isAkanTtsEnabled(): boolean {
  return Boolean(env.AI_TTS_AKAN_URL);
}

async function postSpeech(
  baseUrl: string,
  body: Record<string, unknown>,
  mimeType: string,
): Promise<{ audio: Uint8Array; mimeType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`TTS endpoint ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return { audio: new Uint8Array(await res.arrayBuffer()), mimeType };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Synthesize speech from text (OpenAI `/v1/audio/speech`). Routes to the Twi/Akan engine when
 * `language: 'ak'`, otherwise the English Piper voices. Returns the audio bytes + their MIME type
 * (English = MP3, Twi/Akan = WAV).
 */
export async function synthesize(
  text: string,
  opts: { voice?: string; speed?: number; language?: 'en' | 'ak' } = {},
): Promise<{ audio: Uint8Array; mimeType: string }> {
  const speed = opts.speed ?? 1;

  if (opts.language === 'ak') {
    if (!env.AI_TTS_AKAN_URL) {
      throw new AiUnavailableError('Twi/Akan voice is not configured');
    }
    return postSpeech(
      env.AI_TTS_AKAN_URL,
      { model: 'tts-1', voice: 'aka', input: text, response_format: 'wav', speed },
      'audio/wav',
    );
  }

  if (!env.AI_TTS_URL) throw new AiUnavailableError('Text-to-speech runtime is not configured');
  return postSpeech(
    env.AI_TTS_URL,
    {
      model: env.AI_TTS_MODEL,
      voice: opts.voice || env.AI_TTS_VOICE,
      input: text,
      response_format: 'mp3',
      speed,
    },
    'audio/mpeg',
  );
}
