/**
 * On-prem AI runtime client (SRS — air-gapped). Talks to a local OpenAI-compatible endpoint
 * (vLLM by default; see [[vms-ai-runtime]]) over the LAN — nothing leaves the facility. All AI is
 * OPTIONAL: with AI_LLM_URL unset the runtime is "disabled" and callers must guard with
 * isAiEnabled() (the tRPC layer returns PRECONDITION_FAILED). Mirrors the codebase's
 * disabled-when-unset integration style (accesscontrol.ts / siem.ts).
 */
import { env } from '../../env.ts';

export class AiUnavailableError extends Error {
  constructor(message = 'AI runtime is not configured') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export function isAiEnabled(): boolean {
  return Boolean(env.AI_LLM_URL);
}

export function isEmbeddingEnabled(): boolean {
  return Boolean(env.AI_EMBED_URL ?? env.AI_LLM_URL);
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function postJson(baseUrl: string, path: string, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.AI_LLM_API_KEY ? { authorization: `Bearer ${env.AI_LLM_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`AI endpoint ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Chat completion against the local LLM. `json: true` requests a strict JSON object response. */
export async function chatComplete(
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  if (!env.AI_LLM_URL) throw new AiUnavailableError();
  const data = (await postJson(env.AI_LLM_URL, '/chat/completions', {
    model: env.AI_LLM_MODEL,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  })) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI returned no content');
  return content;
}

/**
 * Multimodal completion against the local vision model (B1 ID extraction). Sends one image (as a
 * data URL) plus a text instruction in the OpenAI vision message format. `json: true` requests a
 * strict JSON object response.
 */
export async function visionComplete(opts: {
  system: string;
  userText: string;
  imageDataUrl: string;
  json?: boolean;
  maxTokens?: number;
}): Promise<string> {
  if (!env.AI_LLM_URL) throw new AiUnavailableError();
  const data = (await postJson(env.AI_LLM_URL, '/chat/completions', {
    model: env.AI_VISION_MODEL,
    messages: [
      { role: 'system', content: opts.system },
      {
        role: 'user',
        content: [
          { type: 'text', text: opts.userText },
          { type: 'image_url', image_url: { url: opts.imageDataUrl } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: opts.maxTokens ?? 512,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  })) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI returned no content');
  return content;
}

/** Embed texts via the local embedding model (bge-m3 by default → 1024-dim vectors). */
export async function embed(texts: string[]): Promise<number[][]> {
  const base = env.AI_EMBED_URL ?? env.AI_LLM_URL;
  if (!base) throw new AiUnavailableError('Embedding runtime is not configured');
  const data = (await postJson(base, '/embeddings', {
    model: env.AI_EMBED_MODEL,
    input: texts,
  })) as { data?: { embedding: number[] }[] };
  const vectors = data.data?.map((d) => d.embedding);
  if (!vectors || vectors.length !== texts.length) {
    throw new Error('AI returned an unexpected number of embeddings');
  }
  return vectors;
}
