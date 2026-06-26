/**
 * A2 — operations copilot. Natural-language questions over live operational data ("who's on site?",
 * "open incidents this week", "show contractors"). SAFE by construction: the LLM never writes SQL —
 * it only picks ONE of a fixed set of views + validated filters (step 1), we run the corresponding
 * parameterized query, then the LLM answers grounded ONLY in the retrieved rows (step 2). Reuses
 * the existing service queries. Audited as an AI action (actorKind 'ai').
 */
import { z } from 'zod';
import { schema } from '@vms/shared';
import { db } from '../../db.ts';
import { recordAudit } from '../../lib/audit.ts';
import { chatComplete } from './client.ts';
import { listVisits } from '../appointments.ts';
import { listIncidents, musterList, securitySummary } from '../security.ts';

type Actor = { id: string; role?: string | null };

const intentSchema = z.object({
  view: z.enum(['on_site', 'visits', 'incidents', 'summary']),
  status: z.enum(schema.visitStatus.enumValues).optional(),
  incidentStatus: z.enum(schema.incidentStatus.enumValues).optional(),
  search: z.string().max(100).optional(),
  lastDays: z.number().int().min(0).max(365).optional(),
});
type Intent = z.infer<typeof intentSchema>;

/** Permission/authorization wording about a specific person ("is X allowed/permitted/banned in?"). */
export const AUTHORIZATION_RE =
  /\b(allowed?|permit(ted)?|clear(ed|ance)?|authori[sz]\w*|banned|barred|deny|denied)\b/i;

/** Neutral operational summary of a person's visit records — never an allow/deny verdict. */
export function presenceFact(name: string, statuses: string[]): string {
  if (!statuses.length) return `I have no visit records matching "${name}".`;
  if (statuses.includes('checked_in')) return `${name} is currently checked in (on site).`;
  if (statuses.includes('denied')) return `${name} has a denied visit on record.`;
  return `${name} has visit records (most recent status: ${statuses[0]}) but is not currently on site.`;
}

async function runQuery(intent: Intent): Promise<{ rows: unknown; count: number }> {
  // Truthy check: lastDays of 0 or absent means "no time filter" (e.g. "right now"/"currently"),
  // NOT "since this instant" — which would filter everything out.
  const from = intent.lastDays ? new Date(Date.now() - intent.lastDays * 86_400_000) : undefined;
  switch (intent.view) {
    case 'on_site': {
      const rows = await musterList();
      return {
        rows: rows.map((r) => ({
          visitor: r.visitorName,
          org: r.organization,
          host: r.hostName,
          facility: r.facilityName,
          since: r.timeIn,
        })),
        count: rows.length,
      };
    }
    case 'visits': {
      const r = await listVisits({ status: intent.status, search: intent.search, from, page: 1, pageSize: 25 });
      return {
        rows: r.items.map((v) => ({
          visitor: v.visitorName,
          org: v.visitorOrg,
          host: v.hostName,
          status: v.status,
          expected: v.expectedArrival,
        })),
        count: r.total,
      };
    }
    case 'incidents': {
      const r = await listIncidents({ status: intent.incidentStatus, page: 1, pageSize: 25 });
      const items = from ? r.items.filter((i) => i.createdAt >= from) : r.items;
      return {
        rows: items.map((i) => ({
          type: i.type,
          severity: i.severity,
          status: i.status,
          visitor: i.visitorName,
          at: i.createdAt,
        })),
        count: items.length,
      };
    }
    case 'summary': {
      return { rows: await securitySummary(), count: 1 };
    }
  }
}

export async function askCopilot(
  question: string,
  actor: Actor,
  opts: { canSeeIncidents: boolean } = { canSeeIncidents: true },
): Promise<{ answer: string; view: Intent['view']; count: number }> {
  // Views are scoped by role: reception (no incident:read) cannot route to the incidents view.
  const views = opts.canSeeIncidents
    ? 'on_site, visits, incidents, summary'
    : 'on_site, visits, summary';

  // Step 1 — route to a view + filters (strict JSON, validated against the enums).
  const raw = await chatComplete(
    [
      {
        role: 'system',
        content: `Route the question to ONE data view and filters. Respond ONLY as JSON:
{"view": one of [${views}], "status"?: one of [${schema.visitStatus.enumValues.join(
          ', ',
        )}], "incidentStatus"?: one of [${schema.incidentStatus.enumValues.join(
          ', ',
        )}], "search"?: a visitor/host/org name to filter by, "lastDays"?: integer days to look back}.
Views: on_site = visitors currently checked in; visits = appointments/visits (use status/search/lastDays);${
          opts.canSeeIncidents ? ' incidents = security incidents (use incidentStatus/lastDays);' : ''
        } summary = high-level counts.
Set "status", "incidentStatus", and "lastDays" ONLY when the user explicitly asks about that status or time range — otherwise OMIT them. To check whether a specific person is present / here / on site / allowed in, use on_site (or visits with just their name in "search") and do NOT add a status filter.`,
      },
      { role: 'user', content: question },
    ],
    { json: true },
  );
  let intent: Intent;
  try {
    intent = intentSchema.parse(JSON.parse(raw));
  } catch {
    intent = { view: 'summary' };
  }

  // Enforce the scope server-side even if the model ignores it (least privilege).
  if (intent.view === 'incidents' && !opts.canSeeIncidents) {
    await recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.role,
      actorKind: 'ai',
      action: 'ai.copilot',
      metadata: { view: 'incidents', denied: true },
    });
    return {
      answer: 'Incident information is restricted to security staff.',
      view: 'incidents',
      count: 0,
    };
  }

  // Authorization questions about a named person ("is X allowed/permitted/banned in?") are answered
  // DETERMINISTICALLY — a small model will hallucinate an allow/deny verdict (even "X is allowed" for
  // a person who does not exist). The copilot reports operational status only and defers the access
  // decision to the visitor record + security watchlist.
  if (intent.search && AUTHORIZATION_RE.test(question)) {
    const name = intent.search.trim();
    const { items } = await listVisits({ search: name, page: 1, pageSize: 25 });
    const answer =
      `I don't make access decisions — whether someone may enter is governed by the visitor record and ` +
      `the security watchlist, not by this assistant. ${presenceFact(
        name,
        items.map((v) => v.status),
      )} To confirm entry, check the visitor's record and the watchlist.`;
    await recordAudit(db, {
      actorId: actor.id,
      actorRole: actor.role,
      actorKind: 'ai',
      action: 'ai.copilot',
      metadata: { authorizationQuery: true, question: question.slice(0, 200) },
    });
    return { answer, view: 'visits', count: items.length };
  }

  const { rows, count } = await runQuery(intent);

  // Step 2 — answer grounded ONLY in the retrieved rows.
  const answer = await chatComplete([
    {
      role: 'system',
      content:
        'Answer the question in plain, natural English prose — full sentences a person could read aloud. ' +
        'Use ONLY the JSON data provided and cite specific counts and names from it. When naming several ' +
        'people or items, write them as a natural sentence list (e.g. "Alice Smith, Bob Jones, and Carol Lee"), ' +
        'never as a JSON array, brackets, code, or bullet points. ' +
        'Report only what the data shows — who is on site, visit status, incidents, counts. You do NOT make ' +
        'access-control or authorization decisions: if asked whether someone is "allowed", "permitted", or ' +
        '"cleared", state what the data shows about their presence and visit status, and add that allow/deny ' +
        'decisions come from the visitor record and the security watchlist, not this assistant. If the data is ' +
        'empty, say you found no matching records — never imply a person is denied or "not allowed" merely ' +
        'because the query returned nothing.',
    },
    {
      role: 'user',
      content: `Question: ${question}\n\nData (view=${intent.view}, ${count} record(s)):\n${JSON.stringify(rows).slice(0, 4000)}`,
    },
  ]);

  await recordAudit(db, {
    actorId: actor.id,
    actorRole: actor.role,
    actorKind: 'ai',
    action: 'ai.copilot',
    metadata: { view: intent.view, question: question.slice(0, 200) },
  });

  return { answer: answer.trim(), view: intent.view, count };
}
