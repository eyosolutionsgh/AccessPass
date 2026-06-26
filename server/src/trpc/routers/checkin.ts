import { z } from 'zod';
import {
  checkInSubmitSchema,
  checkoutLookupSchema,
  tagIssueSchema,
  tagReturnSchema,
  visitIdSchema,
} from '@vms/shared';
import {
  checkOut,
  completeCheckIn,
  guardScan,
  validateLookupReadOnly,
} from '../../services/checkin.ts';
import { checkOutSelf } from '../../services/credentials.ts';
import { getDeviceProfile, getVoiceSettings } from '../../services/admin.ts';
import { issueTag, returnTag, unreturnedTags } from '../../services/tags.ts';
import { synthesize, isTtsEnabled, isAkanTtsEnabled } from '../../services/ai/tts.ts';
import { recordAudit } from '../../lib/audit.ts';
import { db } from '../../db.ts';
import { actorFrom, authorized, authorizedAny, rateLimited } from '../permission.ts';
import { router } from '../trpc.ts';

const ctxOf = (ctx: { ip: string }) => ({ ip: ctx.ip });

const checkoutSubmitSchema = z.object({
  lookup: checkoutLookupSchema,
  deviceId: z.string().max(120).optional(),
  facilityId: z.uuid().optional(),
});

/** A procedure granted to any role that can operate a self-service post (check-in/out/checkpoint). */
function postProcedure() {
  return authorizedAny(
    { checkin: ['process'] },
    { checkin: ['checkout'] },
    { checkin: ['override'] },
  );
}

/** Fixed greeting per voice language, spoken on a successful check-in. */
const WELCOME_TEXT: Record<'en' | 'ak', string> = { en: 'Welcome.', ak: 'Akwaaba.' };
// Synthesize once per (language, voice, speed) — the phrase is fixed, so cache for the process.
const welcomeCache = new Map<string, { audioBase64: string; mimeType: string } | null>();

export const checkinRouter = router({
  /**
   * Reception/security: look up a code/QR and return the appointment details to confirm BEFORE
   * checking in (staff). Read-only — performs no writes, so previewing a code logs/flips nothing.
   */
  assistedLookup: authorized({ checkin: ['process'] })
    .input(checkInSubmitSchema)
    .mutation(({ input, ctx }) =>
      validateLookupReadOnly(input.lookup, {
        ip: ctx.ip,
        facilityId: input.facilityId,
        deviceId: input.deviceId,
      }),
    ),

  /** Reception/security assisted check-in (staff). */
  assistedComplete: authorized({ checkin: ['process'] })
    .input(checkInSubmitSchema)
    .mutation(({ input, ctx }) =>
      completeCheckIn(
        input.lookup,
        { ip: ctx.ip, facilityId: input.facilityId, deviceId: input.deviceId },
        actorFrom(ctx.user),
      ),
    ),

  /** Check a visitor out (staff). */
  checkout: authorized({ checkin: ['checkout'] })
    .input(visitIdSchema)
    .mutation(({ input, ctx }) => checkOut(input.visitId, ctxOf(ctx), actorFrom(ctx.user))),

  /** Check-out by invitation code or badge QR — staff at post, attributed to them. */
  assistedCheckout: authorized({ checkin: ['checkout'] })
    .input(checkoutSubmitSchema)
    .mutation(({ input, ctx }) =>
      checkOutSelf(
        input.lookup,
        { ip: ctx.ip, deviceId: input.deviceId, facilityId: input.facilityId },
        actorFrom(ctx.user),
      ),
    ),

  /** Read this device's profile by deviceId (public — config only, no PII). Drives kiosk behaviour. */
  deviceProfile: rateLimited(60, 60)
    .input(z.object({ deviceId: z.string().max(120) }))
    .query(({ input }) => getDeviceProfile(input.deviceId)),

  /**
   * Guard-operated checkpoint scan (staff, e.g. security_guard/security_manager): returns full
   * visitor/host/visit details for on-the-spot verification and attributes the passage to the
   * scanning guard.
   */
  guardScan: authorized({ checkin: ['override'] })
    .input(checkInSubmitSchema)
    .mutation(({ input, ctx }) =>
      guardScan(input.lookup, { deviceId: input.deviceId, ip: ctx.ip, guardId: ctx.user.id }),
    ),

  /** Issue a reusable tag/NFC to a checked-in visitor — staff at the check-in post. */
  issueTag: authorized({ checkin: ['process'] })
    .input(tagIssueSchema)
    .mutation(({ input }) => issueTag(input)),

  /** Return a tag — frees it for reuse and checks the visitor out (staff at the check-out post). */
  returnTag: authorized({ checkin: ['checkout'] })
    .input(tagReturnSchema)
    .mutation(({ input, ctx }) => returnTag(input, { ip: ctx.ip }, actorFrom(ctx.user))),

  /** Tags currently out (not returned) — reconciliation, staff only. */
  tagsOut: authorized({ checkin: ['checkout'] }).query(() => unreturnedTags()),

  /**
   * Staff signs in to operate a self-service post (check-in/out/checkpoint kiosk) — recorded so
   * inspectors can see who was at a given post at any point in time, independent of individual
   * scan events (which only fire when a visitor is actually present).
   */
  postSignIn: postProcedure()
    .input(z.object({ deviceId: z.string().max(120) }))
    .mutation(({ input, ctx }) =>
      recordAudit(db, {
        actorId: actorFrom(ctx.user).id,
        actorRole: actorFrom(ctx.user).role,
        action: 'checkin.postSignIn',
        objectType: 'device',
        objectId: input.deviceId,
        sourceIp: ctx.ip,
        deviceId: input.deviceId,
      }).then(() => ({ ok: true as const })),
    ),

  /** Staff signs out of a post — pairs with `postSignIn` to bound the staffed period. */
  postSignOut: postProcedure()
    .input(z.object({ deviceId: z.string().max(120) }))
    .mutation(({ input, ctx }) =>
      recordAudit(db, {
        actorId: actorFrom(ctx.user).id,
        actorRole: actorFrom(ctx.user).role,
        action: 'checkin.postSignOut',
        objectType: 'device',
        objectId: input.deviceId,
        sourceIp: ctx.ip,
        deviceId: input.deviceId,
      }).then(() => ({ ok: true as const })),
    ),

  /**
   * Voice greeting played on a successful check-in ("Akwaaba" in Twi / "Welcome" in English),
   * following the configured voice language. Public (the kiosk is unauthenticated) + rate-limited.
   * Returns null when the matching on-prem TTS engine isn't configured.
   */
  welcome: rateLimited(60, 60).query(async () => {
    const { language, voice, speed } = await getVoiceSettings();
    const engineUp = language === 'ak' ? isAkanTtsEnabled() : isTtsEnabled();
    if (!engineUp) return null;
    const key = `${language}:${voice}:${speed}`;
    if (!welcomeCache.has(key)) {
      const { audio, mimeType } = await synthesize(WELCOME_TEXT[language], {
        language,
        voice,
        speed,
      });
      welcomeCache.set(key, { audioBase64: Buffer.from(audio).toString('base64'), mimeType });
    }
    return welcomeCache.get(key) ?? null;
  }),
});
