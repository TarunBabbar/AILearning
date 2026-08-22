import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { Config } from '../config.js';

/**
 * Thin wrapper over the Figma MCP server (`figma-developer-mcp`, aka Framelink).
 *
 * Lifecycle:
 *   const figma = new FigmaMcp(config);
 *   await figma.connect();               // spawns the server over stdio
 *   const data = await figma.call('get_figma_data', { fileKey });
 *   await figma.disconnect();            // closes client + transport (kills child)
 */
export class FigmaMcp {
  private client?: Client;
  private transport?: StdioClientTransport;
  private toolNames = new Set<string>();

  constructor(private readonly config: Config) {}

  async connect(): Promise<void> {
    const env: Record<string, string> = {
      ...getDefaultEnvironment(),
      FIGMA_API_KEY: this.config.figmaAccessToken,
    };

    // On Windows, node can't spawn a .cmd/.bat file directly without a shell.
    // Wrap `npx <pkg> --stdio` in `cmd /c` so the server launches reliably.
    let command = this.config.figmaMcpCommand;
    let args = [...this.config.figmaMcpArgs];
    if (process.platform === 'win32' && command.toLowerCase() === 'npx') {
      command = 'cmd';
      args = ['/c', 'npx', ...this.config.figmaMcpArgs];
    }

    this.transport = new StdioClientTransport({
      command,
      args,
      env,
      stderr: 'pipe',
    });

    // Surface server stderr for debugging (only when DEBUG is set).
    this.transport.stderr?.on('data', (d: Buffer | string) => {
      if (process.env.DEBUG) process.stderr.write(`[figma-mcp] ${String(d)}`);
    });

    this.client = new Client({ name: 'figma-to-playwright-agents', version: '0.1.0' });
    await this.client.connect(this.transport);

    const tools = await this.client.listTools();
    this.toolNames = new Set(tools.tools.map((t) => t.name));
    if (this.toolNames.size === 0) {
      throw new Error('Figma MCP server connected but exposed no tools.');
    }
  }

  /** True if a tool with the given name was exposed by the server. */
  hasTool(name: string): boolean {
    return this.toolNames.has(name);
  }

  /** Names of all tools the server exposed (for logging/inspection). */
  toolList(): string[] {
    return [...this.toolNames];
  }

  async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client) throw new Error('FigmaMcp not connected.');
    if (!this.toolNames.has(name)) {
      throw new Error(`Tool "${name}" is not exposed by the Figma MCP server.`);
    }
    const result = await this.client.callTool({ name, arguments: args });
    if (result.isError) {
      throw new Error(
        `Figma tool "${name}" failed. Inspect the server stderr or args and retry.`,
      );
    }
    // The SDK types collapse the content union; treat it as opaque and pull text.
    const raw = result as unknown as {
      content?: { type?: string; text?: string }[];
    };
    const text = (raw.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string)
      .join('\n');
    return text;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        /* already closed */
      }
    }
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        /* already closed */
      }
    }
    this.client = undefined;
    this.transport = undefined;
    this.toolNames.clear();
  }
}
