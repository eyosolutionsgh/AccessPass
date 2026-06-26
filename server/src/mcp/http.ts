/**
 * Streamable HTTP transport for the VMS MCP server, mounted at /mcp. Stateless (a fresh server +
 * transport per request). Disabled unless MCP_API_KEY is set; requires `Authorization: Bearer
 * <MCP_API_KEY>`. Tools run under MCP_ROLE's RBAC (see mcp/server.ts). Air-gapped: this is a LAN
 * endpoint for an on-prem AI assistant — nothing leaves the facility.
 */
import { Router } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { env } from '../env.ts';
import { logger } from '../logger.ts';
import { buildMcpServer } from './server.ts';

export const mcpRouter = Router();

const rpcError = (code: number, message: string) => ({
  jsonrpc: '2.0' as const,
  error: { code, message },
  id: null,
});

mcpRouter.post('/', async (req, res) => {
  if (!env.MCP_API_KEY) {
    res.status(404).json(rpcError(-32601, 'MCP endpoint not enabled'));
    return;
  }
  if (req.headers.authorization !== `Bearer ${env.MCP_API_KEY}`) {
    res.status(401).json(rpcError(-32001, 'Unauthorized'));
    return;
  }
  try {
    const server = buildMcpServer(env.MCP_ROLE);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error({ err }, 'mcp request failed');
    if (!res.headersSent) res.status(500).json(rpcError(-32603, 'Internal error'));
  }
});

// Stateless mode uses single POST request/response; no SSE stream or session to GET/DELETE.
mcpRouter.get('/', (_req, res) => res.status(405).json(rpcError(-32000, 'Method not allowed')));
mcpRouter.delete('/', (_req, res) => res.status(405).json(rpcError(-32000, 'Method not allowed')));
