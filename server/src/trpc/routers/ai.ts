import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { anyRoleHasPermission } from '@vms/shared';
import { actorFrom, authorized, authorizedAny } from '../permission.ts';
import { router } from '../trpc.ts';
import * as analyst from '../../services/ai/analyst.ts';
import { askCopilot } from '../../services/ai/copilot.ts';
import { extractIdFields } from '../../services/ai/idscan.ts';
import { transcribe, isSttEnabled } from '../../services/ai/stt.ts';
import { synthesize, isTtsEnabled, isAkanTtsEnabled } from '../../services/ai/tts.ts';
import { getVoiceSettings } from '../../services/admin.ts';
import { isAiEnabled } from '../../services/ai/client.ts';

/** Guard AI procedures when the on-prem runtime isn't configured (AI_LLM_URL unset). */
function ensureAi() {
  if (!isAiEnabled()) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'AI runtime is not configured' });
  }
}

/**
 * A4 AI analyst router. `analyst:['read']` gates summaries / Q&A / similarity; `analyst:['suggest']`
 * gates classification suggestions. LLM-invoking calls are mutations (explicit, audited as 'ai').
 */
export const aiRouter = router({
  // Any AI-capable role (analyst read OR copilot operations) may check status.
  status: authorizedAny({ analyst: ['read'] }, { analyst: ['operations'] }).query(() => ({
    enabled: isAiEnabled(),
    voice: isSttEnabled(),
    speak: isTtsEnabled(),
    akan: isAkanTtsEnabled(),
  })),

  summarizeIncident: authorized({ analyst: ['read'] })
    .input(z.object({ incidentId: z.uuid() }))
    .mutation(({ input, ctx }) => {
      ensureAi();
      return analyst.summarizeIncident(input.incidentId, actorFrom(ctx.user));
    }),

  suggestClassification: authorized({ analyst: ['suggest'] })
    .input(z.object({ description: z.string().min(1).max(2000) }))
    .mutation(({ input, ctx }) => {
      ensureAi();
      return analyst.suggestClassification(input.description, actorFrom(ctx.user));
    }),

  askAudit: authorized({ analyst: ['read'] })
    .input(z.object({ question: z.string().min(1).max(500) }))
    .mutation(({ input, ctx }) => {
      ensureAi();
      return analyst.askAudit(input.question, actorFrom(ctx.user));
    }),

  /** Operations copilot — NL questions over live visitor/visit/incident data (safe view routing).
   *  `operations` is granted to reception + security; the incidents view additionally requires
   *  `incident:['read']`, so reception cannot reach security incident data. */
  copilot: authorized({ analyst: ['operations'] })
    .input(z.object({ question: z.string().min(1).max(500) }))
    .mutation(({ input, ctx }) => {
      ensureAi();
      const role = (ctx.user as { role?: string | null }).role ?? null;
      return askCopilot(input.question, actorFrom(ctx.user), {
        canSeeIncidents: anyRoleHasPermission(role, { incident: ['read'] }),
      });
    }),

  similarIncidents: authorized({ analyst: ['read'] })
    .input(z.object({ incidentId: z.uuid(), k: z.number().int().min(1).max(20).default(5) }))
    .query(({ input }) => analyst.similarIncidents(input.incidentId, input.k)),

  /** A1 — transcribe a short audio clip (voice input for the copilot) via the on-prem Whisper. */
  transcribe: authorized({ analyst: ['operations'] })
    .input(z.object({ audioBase64: z.string().min(1).max(6_000_000), mimeType: z.string().max(60) }))
    .mutation(async ({ input }) => {
      if (!isSttEnabled()) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Voice input is not configured' });
      }
      const text = await transcribe(Buffer.from(input.audioBase64, 'base64'), input.mimeType);
      return { text };
    }),

  /** A1 — read an AI answer aloud (voice output) via the on-prem Piper TTS. Returns MP3 audio. */
  speak: authorizedAny({ analyst: ['read'] }, { analyst: ['operations'] })
    .input(z.object({ text: z.string().min(1).max(4000) }))
    .mutation(async ({ input }) => {
      if (!isTtsEnabled()) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Voice output is not configured' });
      }
      const { language, voice, speed } = await getVoiceSettings();
      const { audio, mimeType } = await synthesize(input.text, { language, voice, speed });
      return { audioBase64: Buffer.from(audio).toString('base64'), mimeType };
    }),

  /** B1 — extract identity fields from an ID-document photo to auto-fill the visitor form. */
  extractId: authorized({ checkin: ['process'] })
    .input(
      z.object({
        imageBase64: z.string().min(1).max(8_000_000),
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      }),
    )
    .mutation(({ input, ctx }) => {
      ensureAi();
      return extractIdFields(
        `data:${input.mimeType};base64,${input.imageBase64}`,
        actorFrom(ctx.user),
      );
    }),

  /** Backfill embeddings for incidents that have none (e.g. raised before AI was enabled). */
  backfillEmbeddings: authorized({ analyst: ['suggest'] })
    .input(z.object({ limit: z.number().int().min(1).max(500).default(100) }))
    .mutation(({ input }) => {
      ensureAi();
      return analyst.backfillIncidentEmbeddings(input.limit);
    }),
});
