import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Load .env whether the server is started from the repo root or from server/.
for (const candidate of ['.env', '../.env']) {
  const abs = resolve(process.cwd(), candidate);
  if (existsSync(abs)) {
    config({ path: abs });
    break;
  }
}

/**
 * Robust boolean env parsing. NOTE: `z.coerce.boolean()` uses JS `Boolean()`, so the string
 * "false" coerces to `true` — never use it for env flags. This treats only truthy tokens as true.
 */
const envBool = (def: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(def)
    .transform((v) =>
      typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()),
    );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.url().default('http://localhost:4000'),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),

  BETTER_AUTH_SECRET: z.string().min(16),
  BETTER_AUTH_URL: z.url().default('http://localhost:4000'),

  QR_TOKEN_SECRET: z.string().min(16),
  FIELD_ENCRYPTION_KEY: z.string().min(16),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('vms-documents'),
  S3_FORCE_PATH_STYLE: envBool(true),

  // Email — MailerSend HTTP API (transactional). MAILERSEND_API_TOKEN is optional so the server
  // still boots without it (sends then fail and are retried by the dispatcher until it's set).
  // FROM_EMAIL must be on a MailerSend-verified domain (3dt.com.gh).
  EMAIL_PROVIDER: z.enum(['mailersend']).default('mailersend'),
  MAILERSEND_API_TOKEN: z.string().optional(),
  MAILERSEND_FROM_EMAIL: z.string().default('vms@3dt.com.gh'),
  MAILERSEND_FROM_NAME: z.string().default('vms'),

  // Product/portal name shown in transactional emails (e.g. "Set your <PLATFORM_NAME> password").
  // Distinct from the per-institution organisation name (admin-configurable, e.g. "Jubilee House").
  PLATFORM_NAME: z.string().default('Visitor Management System'),

  // SMS (SRS §10.2). Provider-based; `nalo` matches the Nalo Solutions gateway used across
  // projects. Unset SMS_PROVIDER (or missing credentials) = SMS channel disabled.
  // Blank string (a present-but-empty .env line) must read as "disabled", not a validation error
  // that would crash boot — `.optional()` alone only permits a missing key, not "".
  // Casing is also normalised so an operator writing `SMS_PROVIDER=Nalo` doesn't crash boot.
  SMS_PROVIDER: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim().toLowerCase() : undefined),
    z.enum(['nalo']).optional(),
  ),
  NALO_SMS_USERNAME: z.string().optional(),
  NALO_SMS_PASSWORD: z.string().optional(),
  NALO_SMS_SOURCE: z.string().default('VMS'),
  NALO_SMS_ENDPOINT: z
    .string()
    .default('https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/'),

  // Internal chat notifications (SRS §10.2) — Mattermost/Rocket.Chat-compatible incoming webhook.
  // Self-hostable on-prem (air-gap friendly). Unset CHAT_WEBHOOK_URL = chat channel disabled.
  CHAT_WEBHOOK_URL: z.string().optional(),
  CHAT_DEFAULT_CHANNEL: z.string().optional(),
  CHAT_USERNAME: z.string().default('VMS'),
  // Channel/handle that security incidents are posted to; falls back to CHAT_DEFAULT_CHANNEL.
  SECURITY_CHAT_CHANNEL: z.string().optional(),

  // On-prem AI runtime (air-gapped, OpenAI-compatible — e.g. vLLM). All optional; unset = AI
  // features disabled. AI_LLM_URL is the API base, e.g. http://localhost:8000/v1.
  AI_LLM_URL: z.string().optional(),
  AI_LLM_MODEL: z.string().default('qwen2.5-14b-instruct-awq'),
  AI_LLM_API_KEY: z.string().optional(),
  AI_EMBED_URL: z.string().optional(), // defaults to AI_LLM_URL when unset
  AI_EMBED_MODEL: z.string().default('bge-m3'),
  // Vision model for ID-document field extraction (B1) — served on AI_LLM_URL (multimodal LLM).
  AI_VISION_MODEL: z.string().default('ai/gemma3'),
  // Speech-to-text (A1 voice input) — OpenAI-compatible Whisper server. Unset = voice input disabled.
  AI_STT_URL: z.string().optional(), // e.g. http://localhost:9099/v1
  AI_STT_MODEL: z.string().default('base'),
  // Text-to-speech (A1 voice output) — OpenAI-compatible Piper server. Unset = read-aloud disabled.
  // Voice (alloy/echo/fable/onyx/nova/shimmer) + speed are admin-configurable (System settings);
  // AI_TTS_VOICE is the fallback when no voice is selected.
  AI_TTS_URL: z.string().optional(), // e.g. http://localhost:9088/v1
  AI_TTS_MODEL: z.string().default('tts-1'),
  AI_TTS_VOICE: z.string().default('nova'),
  // Twi/Akan TTS — separate OpenAI-compatible engine (BibleTTS Asante via Coqui, docker-compose
  // `twi-tts`). Unset = the Twi/Akan voice language is unavailable (read-aloud falls back to
  // English). e.g. :9087/v1.
  AI_TTS_AKAN_URL: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().default(30_000),

  // MCP server (A3) — exposes read-only VMS tools to an on-prem AI assistant. Unset MCP_API_KEY =
  // /mcp disabled. Tools run under MCP_ROLE's RBAC (e.g. 'auditor' for a narrower surface).
  MCP_API_KEY: z.string().optional(),
  MCP_ROLE: z.string().default('security_manager'),

  // Integrations (SRS §10.4) — all optional; unset = feature disabled.
  INTEGRATION_API_KEY: z.string().optional(),
  ACCESS_CONTROL_WEBHOOK_URL: z.string().optional(),
  SIEM_WEBHOOK_URL: z.string().optional(),
  RETENTION_DAYS_DEFAULT: z.coerce.number().int().min(1).default(365),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:\n', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
