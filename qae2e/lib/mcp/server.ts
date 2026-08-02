// Real MCP server built on the same tool handlers the web runner uses.
// Exposed to external clients over Streamable HTTP at /api/mcp.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "../agents/tools";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "qae2e",
    version: "1.0.0",
  });

  for (const tool of tools) {
    // Our tool handlers validate args defensively, so no Zod schema is needed —
    // args flow through as raw JSON from the client.
    server.registerTool(
      tool.name,
      { description: tool.description },
      async (args: Record<string, unknown>) => {
        const result = await tool.handler(args ?? {});
        return { content: result.content };
      }
    );
  }

  return server;
}
