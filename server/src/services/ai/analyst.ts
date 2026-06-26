/**
 * A4 — AI incident/audit analyst. Summarizes incidents, suggests classifications, answers
 * natural-language questions over the (now tamper-evident) audit log, and finds similar incidents
 * via pgvector. All LLM calls go to the local on-prem runtime (client.ts). Every AI-produced action
 * is recorded in the audit log with actorKind 'ai' (provenance — see audit findings #4–#6).
 */
import { and, cosineDistance, desc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { schema } from '@vms/shared';
import { z } from 'zod';
import { db } from '../../db.ts';
import { env } from '../../env.ts';
import { recordAudit, verifyAuditChain } from '../../lib/audit.ts';
import { chatComplete, embed } from './client.ts';

type Actor = { id: string; role?: string | null };

const classificationSchema = z.object({
  type: z.enum(schema.incidentType.enumValues),
  severity: z.enum(schema.incidentSeverity.enumValues),
  rationale: z.string().max(500),
});
export type IncidentClassification = z.infer<typeof classificationSchema>;

async function loadIncidentContext(incidentId: string) {
  const [inc] = await db.select().from(schema.incident).where(eq(schema.incident.id, incidentId));
  if (!inc) return null;
  let visitor: { fullName: string } | undefined;
  let host: { name: string } | undefined;
  if (inc.visitId) {
    const [v] = await db.select().from(schema.visit).where(eq(schema.visit.id, inc.visitId));
    if (v) {
      [visitor] = await db
        .select({ fullName: schema.visitor.fullName })
        .from(schema.visitor)
        .where(eq(schema.visitor.id, v.visitorId));
      [host] = await db
        .select({ name: schema.host.name })
        .from(schema.host)
        .where(eq(schema.host.id, v.hostId));
    }
  }
  return { inc, visitor, host };
}

/** Factual AI summary of an incident for a duty officer. Audited as an AI action. */
export async function summarizeIncident(
  incidentId: string,
  actor: Actor,
): Promise<{ summary: string }> {
  const ctx = await loadIncidentContext(incidentId);
  if (!ctx) throw new Error('Incident not found');
  const { inc, visitor, host } = ctx;
  const facts = [
    `Type: ${inc.type}`,
    `Severity: ${inc.severity}`,
    `Status: ${inc.status}`,
    inc.description ? `Description: ${inc.description}` : null,
    visitor ? `Visitor: ${visitor.fullName}` : null,
    host ? `Host: ${host.name}` : null,
    `Raised: ${inc.createdAt.toISOString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const summary = await chatComplete([
    {
      role: 'system',
      content:
        'You are a security duty-officer assistant. Summarize the incident factually in 2-3 sentences. Do not speculate beyond the facts provided.',
    },
    { role: 'user', content: facts },
  ]);

  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    actorKind: 'ai',
    action: 'ai.summarize_incident',
    objectType: 'incident',
    objectId: incidentId,
    metadata: { model: env.AI_LLM_MODEL },
  });
  return { summary: summary.trim() };
}

/** Suggest an incident type + severity from free text (strict JSON, validated against the enums). */
export async function suggestClassification(
  description: string,
  actor: Actor,
): Promise<IncidentClassification> {
  const raw = await chatComplete(
    [
      {
        role: 'system',
        content: `Classify the security incident. Respond ONLY as JSON: {"type": one of [${schema.incidentType.enumValues.join(
          ', ',
        )}], "severity": one of [${schema.incidentSeverity.enumValues.join(
          ', ',
        )}], "rationale": short string}.`,
      },
      { role: 'user', content: description },
    ],
    { json: true },
  );
  const parsed = classificationSchema.parse(JSON.parse(raw));
  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    actorKind: 'ai',
    action: 'ai.suggest_classification',
    objectType: 'incident',
    metadata: { suggested: parsed.type, severity: parsed.severity },
  });
  return parsed;
}

/** Answer an NL question over the most recent audit entries, with chain-integrity context. */
export async function askAudit(
  question: string,
  actor: Actor,
): Promise<{ answer: string; integrity: { ok: boolean; checked: number } }> {
  const rows = await db
    .select({
      createdAt: schema.auditLog.createdAt,
      action: schema.auditLog.action,
      actorRole: schema.auditLog.actorRole,
      actorKind: schema.auditLog.actorKind,
      result: schema.auditLog.result,
      objectType: schema.auditLog.objectType,
    })
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.seq))
    .limit(50);
  const integrity = await verifyAuditChain(db);
  const context = rows
    .map(
      (r) =>
        `${r.createdAt.toISOString()} ${r.action} (${r.actorKind}/${r.actorRole ?? '-'}) ${r.result} ${r.objectType ?? ''}`,
    )
    .join('\n');

  const answer = await chatComplete([
    {
      role: 'system',
      content:
        'Answer the question using ONLY the audit-log entries provided. If the answer is not in them, say you cannot determine it. Be concise.',
    },
    { role: 'user', content: `Question: ${question}\n\nAudit entries (most recent first):\n${context}` },
  ]);

  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    actorKind: 'ai',
    action: 'ai.ask_audit',
    metadata: { question: question.slice(0, 200) },
  });
  return { answer: answer.trim(), integrity: { ok: integrity.ok, checked: integrity.checked } };
}

/** Generate + store the embedding for an incident (enables similar-incident search). */
export async function embedIncident(incidentId: string): Promise<boolean> {
  const [inc] = await db
    .select({ type: schema.incident.type, description: schema.incident.description })
    .from(schema.incident)
    .where(eq(schema.incident.id, incidentId));
  if (!inc) return false;
  const text = `${inc.type}: ${inc.description ?? ''}`.trim();
  const [vector] = await embed([text]);
  await db.update(schema.incident).set({ embedding: vector }).where(eq(schema.incident.id, incidentId));
  return true;
}

/** Embed all incidents missing an embedding (batched in one embed() call). For backfilling history. */
export async function backfillIncidentEmbeddings(limit = 100): Promise<{ embedded: number }> {
  const rows = await db
    .select({
      id: schema.incident.id,
      type: schema.incident.type,
      description: schema.incident.description,
    })
    .from(schema.incident)
    .where(isNull(schema.incident.embedding))
    .limit(limit);
  if (rows.length === 0) return { embedded: 0 };
  const vectors = await embed(rows.map((r) => `${r.type}: ${r.description ?? ''}`.trim()));
  for (let i = 0; i < rows.length; i++) {
    await db
      .update(schema.incident)
      .set({ embedding: vectors[i] })
      .where(eq(schema.incident.id, rows[i]!.id));
  }
  return { embedded: rows.length };
}

/** Find incidents semantically similar to the given one (pgvector cosine distance). */
export async function similarIncidents(incidentId: string, k = 5) {
  const [target] = await db
    .select({ embedding: schema.incident.embedding })
    .from(schema.incident)
    .where(eq(schema.incident.id, incidentId));
  if (!target?.embedding) return [];
  const distance = cosineDistance(schema.incident.embedding, target.embedding);
  return db
    .select({
      id: schema.incident.id,
      type: schema.incident.type,
      severity: schema.incident.severity,
      description: schema.incident.description,
      similarity: sql<number>`1 - (${distance})`,
    })
    .from(schema.incident)
    .where(and(ne(schema.incident.id, incidentId), isNotNull(schema.incident.embedding)))
    .orderBy(distance)
    .limit(k);
}
