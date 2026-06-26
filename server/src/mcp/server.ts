/**
 * MCP server (A3) — exposes the VMS as Model Context Protocol tools so an on-prem AI assistant can
 * query visitor/visit/incident data. AIR-GAPPED + READ-ONLY: every tool is a read query backed by
 * an existing service function; there are NO mutating tools. Tools are gated by the configured
 * `MCP_ROLE` via the same RBAC the app uses (NOT a flat unscoped key) — so the MCP surface can be
 * narrowed (e.g. `auditor`) without code changes. A fresh server is built per request (stateless).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { anyRoleHasPermission, schema, type PermissionRequest } from '@vms/shared';
import { listVisits } from '../services/appointments.ts';
import { listIncidents, musterList, securitySummary } from '../services/security.ts';
import { similarIncidents } from '../services/ai/analyst.ts';

const text = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});
const denied = () => ({
  content: [{ type: 'text' as const, text: 'Not permitted for the configured MCP role.' }],
  isError: true,
});

export function buildMcpServer(role: string): McpServer {
  const server = new McpServer({ name: 'vms', version: '1.0.0' });
  const can = (perm: PermissionRequest) => anyRoleHasPermission(role, perm);

  server.registerTool(
    'vms_on_site_visitors',
    {
      title: 'On-site visitors',
      description: 'List visitors currently checked in (name, organization, host, facility, time in).',
    },
    async () => (can({ dashboard: ['security'] }) ? text(await musterList()) : denied()),
  );

  server.registerTool(
    'vms_security_summary',
    {
      title: 'Security summary',
      description: 'High-level counts: on-site, open incidents, overstays, denied in the last 24h.',
    },
    async () => (can({ dashboard: ['security'] }) ? text(await securitySummary()) : denied()),
  );

  server.registerTool(
    'vms_list_visits',
    {
      title: 'List visits',
      description: 'List appointments/visits, optionally filtered by status, a name/org search, or recency.',
      inputSchema: {
        status: z.enum(schema.visitStatus.enumValues).optional(),
        search: z.string().max(100).optional(),
        lastDays: z.number().int().min(1).max(365).optional(),
      },
    },
    async ({ status, search, lastDays }) => {
      if (!can({ appointment: ['read'] })) return denied();
      const from = lastDays ? new Date(Date.now() - lastDays * 86_400_000) : undefined;
      const r = await listVisits({ status, search, from, page: 1, pageSize: 50 });
      return text({ total: r.total, items: r.items });
    },
  );

  server.registerTool(
    'vms_list_incidents',
    {
      title: 'List incidents',
      description: 'List security incidents, optionally filtered by status.',
      inputSchema: { status: z.enum(schema.incidentStatus.enumValues).optional() },
    },
    async ({ status }) => {
      if (!can({ incident: ['read'] })) return denied();
      const r = await listIncidents({ status, page: 1, pageSize: 50 });
      return text({ total: r.total, items: r.items });
    },
  );

  server.registerTool(
    'vms_similar_incidents',
    {
      title: 'Similar incidents',
      description: 'Find incidents semantically similar to a given incident (on-prem vector search).',
      inputSchema: { incidentId: z.uuid(), k: z.number().int().min(1).max(20).optional() },
    },
    async ({ incidentId, k }) =>
      can({ analyst: ['read'] }) ? text(await similarIncidents(incidentId, k ?? 5)) : denied(),
  );

  return server;
}
