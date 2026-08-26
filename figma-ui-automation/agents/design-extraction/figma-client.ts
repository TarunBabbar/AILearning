import type { Config } from '../../shared/lib/config.ts';
import { log } from '../../shared/lib/logger.ts';

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: FigmaNode[];
  characters?: string;
  fills?: Array<{ type: string; visible?: boolean; color?: { r: number; g: number; b: number; a?: number }; imageRef?: string } | null>;
  strokes?: Array<{ type: string; visible?: boolean; color?: { r: number; g: number; b: number; a?: number } } | null>;
  cornerRadius?: number;
  fontSize?: number;
  fontWeight?: number;
  fontName?: { family?: string; style?: string };
  style?: Record<string, unknown>;
}

export interface FigmaFileResponse {
  name: string;
  lastModified: string;
  document: FigmaNode;
}

export interface FigmaImageResponse {
  err: string | null;
  images: Record<string, string | null>;
}

export interface FigmaProvider {
  readonly name: string;
  readonly configured: boolean;
  getFile(fileKey: string): Promise<FigmaFileResponse>;
  getNode(fileKey: string, nodeId: string): Promise<{ node: FigmaNode; name: string; lastModified: string }>;
  getImages(fileKey: string, nodeIds: string[]): Promise<Record<string, string | null>>;
}

const API = 'https://api.figma.com/v1';

/**
 * Figma REST API provider — the pipeline's primary path (scriptable, CI-friendly).
 * The Dev Mode MCP server can be added later as a second provider behind the same interface.
 */
export class FigmaRestProvider implements FigmaProvider {
  readonly name = 'figma-rest';
  private cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  get configured(): boolean {
    return Boolean(this.cfg.figmaToken);
  }

  private async request<T>(path: string): Promise<T> {
    if (!this.configured) throw new Error('FIGMA_ACCESS_TOKEN is not set; add it to .env or run in sample mode');
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${this.cfg.figmaToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Figma API ${res.status} for ${path}: ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async getFile(fileKey: string): Promise<FigmaFileResponse> {
    log.debug('figma', `GET /files/${fileKey}`);
    return this.request<FigmaFileResponse>(`/files/${fileKey}?depth=4`);
  }

  async getNode(fileKey: string, nodeId: string): Promise<{ node: FigmaNode; name: string; lastModified: string }> {
    log.debug('figma', `GET /files/${fileKey}/nodes?ids=${nodeId}`);
    const res = await this.request<{ nodes: Record<string, { document: FigmaNode }>; name: string; lastModified: string }>(
      `/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&depth=6`,
    );
    const entry = res.nodes?.[nodeId];
    if (!entry) throw new Error(`Figma node ${nodeId} not found in file ${fileKey}`);
    return { node: entry.document, name: res.name, lastModified: res.lastModified };
  }

  async getImages(fileKey: string, nodeIds: string[]): Promise<Record<string, string | null>> {
    if (nodeIds.length === 0) return {};
    log.debug('figma', `GET /images/${fileKey}?ids=${nodeIds.join(',')}&format=png&scale=1`);
    const res = await this.request<FigmaImageResponse>(
      `/images/${fileKey}?ids=${encodeURIComponent(nodeIds.join(','))}&format=png&scale=1`,
    );
    return res.images;
  }
}
