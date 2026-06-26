/**
 * B1 — ID-document field extraction. Sends an ID photo (passport / driver's licence / national ID)
 * to the on-prem vision model and returns structured fields to auto-fill the visitor form, cutting
 * manual typing at the desk/kiosk. Air-gapped: the image goes only to the local model, never a
 * cloud OCR service. Audited as an AI action. The image itself is NOT persisted here — only the
 * extracted fields are returned for the staff/visitor to confirm.
 */
import { z } from 'zod';
import { db } from '../../db.ts';
import { recordAudit } from '../../lib/audit.ts';
import { visionComplete } from './client.ts';

type Actor = { id: string; role?: string | null };

const idFieldsSchema = z.object({
  fullName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  documentType: z.string().nullable(),
  documentNumber: z.string().nullable(),
  nationality: z.string().nullable(),
  expiryDate: z.string().nullable(),
});
export type ExtractedId = z.infer<typeof idFieldsSchema>;

const EMPTY: ExtractedId = {
  fullName: null,
  dateOfBirth: null,
  documentType: null,
  documentNumber: null,
  nationality: null,
  expiryDate: null,
};

export async function extractIdFields(imageDataUrl: string, actor: Actor): Promise<ExtractedId> {
  // NOTE: not using strict `json` response_format — vision models (e.g. gemma3 via DMR) read the
  // document fine but often ignore JSON-grammar mode for image inputs. We instead prompt for JSON
  // and leniently extract the first {...} object from the reply.
  const raw = await visionComplete({
    system:
      'You read identity documents (passport, driver’s licence, national ID). Respond with ONLY a JSON object (no prose, no markdown) using exactly these keys: fullName, dateOfBirth, documentType, documentNumber, nationality, expiryDate. fullName must be the person’s COMPLETE name — combine surname and given names when printed separately (given names first, surname last). Use ISO format YYYY-MM-DD for dates. Use null for any field that is not clearly visible. NEVER invent or guess values.',
    userText: 'Extract the identity fields from this document image as JSON.',
    imageDataUrl,
  });

  // The model output is untrusted text — extract the JSON object and parse defensively.
  let parsed: ExtractedId;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  try {
    parsed = start >= 0 && end > start ? idFieldsSchema.parse(JSON.parse(raw.slice(start, end + 1))) : EMPTY;
  } catch {
    parsed = EMPTY;
  }

  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    actorKind: 'ai',
    action: 'ai.extract_id',
    metadata: { documentType: parsed.documentType, hasName: Boolean(parsed.fullName) },
  });
  return parsed;
}
