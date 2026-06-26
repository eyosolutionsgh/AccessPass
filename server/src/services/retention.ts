import { inArray, sql } from 'drizzle-orm';
import { schema } from '@vms/shared';
import { db } from '../db.ts';
import { recordAudit } from '../lib/audit.ts';
import { logger } from '../logger.ts';
import { getRetentionDays } from './admin.ts';

const REDACTED = '[redacted]';
const CLOSED = "('checked_out','cancelled','denied','no_show','expired')";

/**
 * Anonymize visitor PII past the configured retention period (SRS FR-104, §9.3). A visitor is
 * eligible only when ALL their visits are closed and older than the cutoff, and none is under an
 * open incident (a proxy for legal hold / active investigation). Deletion evidence is audited
 * without retaining the personal data itself.
 */
export async function runRetentionSweep(): Promise<{ anonymized: number }> {
  const days = await getRetentionDays();
  const cutoff = new Date(Date.now() - days * 86_400_000);

  const result = await db.execute<{ id: string }>(sql`
    select v.id from visitor v
    where v.full_name <> ${REDACTED}
      and exists (select 1 from visit where visitor_id = v.id)
      and not exists (
        select 1 from visit
        where visitor_id = v.id
          and (status not in ${sql.raw(CLOSED)} or created_at >= ${cutoff})
      )
      and not exists (
        select 1 from incident i
        join visit vi on vi.id = i.visit_id
        where vi.visitor_id = v.id and i.status = 'open'
      )
  `);

  const ids = result.rows.map((r) => r.id);
  if (ids.length === 0) return { anonymized: 0 };

  await db
    .update(schema.visitor)
    .set({ fullName: REDACTED, email: null, phone: null, idReferenceEnc: null, notes: null })
    .where(inArray(schema.visitor.id, ids));

  await recordAudit(db, {
    action: 'retention.anonymize',
    objectType: 'visitor',
    metadata: { count: ids.length, retentionDays: days },
  });
  logger.info({ anonymized: ids.length, retentionDays: days }, 'retention sweep');
  return { anonymized: ids.length };
}
