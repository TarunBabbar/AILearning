import { NextRequest } from "next/server";
import { createMcpServer } from "@/lib/mcp/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Real MCP server over Streamable HTTP (GET + POST + DELETE).
 * External clients (Claude Code, MCP Inspector, custom tools) connect here and
 * get the same QA tools the web workspace uses.
 *
 * Sessions are cached in globalThis keyed by the transport's session id, so one
 * client keeps one initialized server across requests.
 */

type CachedSession = {
  transport: WebStandardStreamableHTTPServerTransport;
  lastSeen: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __mcpSessions: Map<string, CachedSession> | undefined;
}

function getSessions(): Map<string, CachedSession> {
  if (!globalThis.__mcpSessions) globalThis.__mcpSessions = new Map();
  return globalThis.__mcpSessions;
}

async function handle(req: NextRequest) {
  const sessions = getSessions();
  const now = Date.now();
  const sessionId = req.headers.get("Mcp-Session-Id");

  // Reuse an existing fresh session.
  if (sessionId) {
    const existing = sessions.get(sessionId);
    if (existing && now - existing.lastSeen < 15 * 60_000) {
      existing.lastSeen = now;
      return existing.transport.handleRequest(req);
    }
  }

  // New client: create a server + transport.
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  await server.connect(transport);

  const res = await transport.handleRequest(req);

  // Key the cache by the session id the transport assigned (sent in headers).
  const assigned = res.headers.get("Mcp-Session-Id");
  const key = assigned || crypto.randomUUID();
  sessions.set(key, { transport, lastSeen: now });

  return res;
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function DELETE(req: NextRequest) {
  return handle(req);
}
