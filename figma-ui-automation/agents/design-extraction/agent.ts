import type { Config } from '../../shared/lib/config.ts';
import { log } from '../../shared/lib/logger.ts';
import { FigmaRestProvider, type FigmaNode, type FigmaProvider } from './figma-client.ts';
import { getSampleSpec } from './sample.ts';
import type { Element, ElementRole, Spec } from '../../shared/types/index.ts';
import { writeJson } from '../../shared/lib/fs.ts';
import { renderSpecPng } from '../validation/render.ts';

export interface DesignExtractionResult {
  spec: Spec;
  screenshotPath?: string;
  provider: string;
  warnings: string[];
}

const TEXT_TYPES = new Set(['TEXT']);
const FRAME_TYPES = new Set(['FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION']);

function figmaColor(c: { r: number; g: number; b: number }): string {
  const to255 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `#${[to255(c.r), to255(c.g), to255(c.b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function inferRole(type: string, name: string, chars?: string): ElementRole {
  const n = name.toLowerCase();
  if (type === 'TEXT') return n.includes('button') || n.includes('cta') || n.includes('submit') ? 'button' : n.includes('link') ? 'link' : n.includes('heading') || n.includes('header') || n.includes('title') ? 'heading' : 'text';
  if (type === 'INPUT') return 'input';
  if (n.includes('avatar') || n.includes('logo')) return n.includes('logo') ? 'image' : 'avatar';
  if (n.includes('card') || n.includes('summary')) return 'card';
  if (n.includes('nav')) return 'nav';
  if (n.includes('image') || n.includes('logo') || n.includes('icon')) return 'image';
  return 'other';
}

function flatten(node: FigmaNode, out: Element[], screenId: string): void {
  if (node.visible === false) return;
  if (!FRAME_TYPES.has(node.type) && !TEXT_TYPES.has(node.type)) return;

  const id = `${screenId}-${node.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const fill = node.fills?.find((f) => f?.type === 'SOLID' && f.visible !== false);
  const stroke = node.strokes?.find((s) => s?.type === 'SOLID' && s.visible !== false);

  out.push({
    id,
    name: node.name,
    type: node.type,
    role: inferRole(node.type, node.name, node.characters),
    ...(node.characters ? { text: node.characters } : {}),
    bounds: {
      x: Math.round(node.x ?? 0),
      y: Math.round(node.y ?? 0),
      w: Math.round(node.width ?? 0),
      h: Math.round(node.height ?? 0),
    },
    styles: {
      ...(fill?.color ? { bg: figmaColor(fill.color) } : {}),
      ...(node.fontSize ? { fontSize: node.fontSize } : {}),
      ...(node.fontWeight ? { fontWeight: node.fontWeight } : {}),
      ...(node.fontName?.family ? { fontFamily: node.fontName.family } : {}),
      ...(node.cornerRadius ? { radius: node.cornerRadius } : {}),
      ...(stroke?.color ? { border: `1px solid ${figmaColor(stroke.color)}` } : {}),
    },
    a11y: node.characters ? { label: node.characters } : {},
  });

  for (const child of node.children ?? []) flatten(child, out, screenId);
}

/**
 * Agent 1 — Design Extraction.
 * Primary: Figma REST API (file nodes → elements/styles, image render → screenshot).
 * Fallback: Dev Mode MCP (via FigmaProvider interface) or bundled sample specs (sample mode).
 */
export class DesignExtractionAgent {
  private cfg: Config;
  private provider?: FigmaProvider;

  constructor(cfg: Config, provider?: FigmaProvider) {
    this.cfg = cfg;
    this.provider = provider;
  }

  async run(screenId: string): Promise<DesignExtractionResult> {
    if (this.cfg.mode === 'sample' || !this.provider?.configured) {
      const sample = getSampleSpec(screenId);
      if (!sample) throw new Error(`No sample spec for screen "${screenId}" (available: login, checkout)`);
      log.info('design-extraction', `sample mode: using bundled spec for "${screenId}"`);
      const screenshotPath = this.saveSampleScreenshot(screenId, sample);
      return { spec: sample, screenshotPath, provider: 'sample', warnings: ['sample mode: not a live Figma design'] };
    }

    const p = this.provider;
    const fileKey = this.cfg.figmaFileKey || sampleSource(screenId);
    if (!fileKey) throw new Error('FIGMA_FILE_KEY is not set; add it to .env or run in sample mode');

    log.info('design-extraction', `fetching ${screenId} from Figma via ${p.name}`);
    const { node, name, lastModified } = await p.getNode(fileKey, `frame-${screenId}`);
    const elements: Element[] = [];
    flatten(node, elements, screenId);

    const spec: Spec = {
      schemaVersion: 1,
      kind: 'design',
      screen: {
        id: screenId,
        name,
        source: p.name,
        figmaFileKey: fileKey,
        frameId: `frame-${screenId}`,
        designVersion: lastModified.slice(0, 10),
        retrievedAt: new Date().toISOString(),
      },
      viewport: {
        width: Math.round(node.width ?? 1440),
        height: Math.round(node.height ?? 900),
        deviceScaleFactor: 1,
      },
      elements,
      interactions: [], // PRD/annotations enrich this later
    };

    const screenshotPath = await this.captureScreenshot(fileKey, node, screenId);
    return { spec, screenshotPath, provider: p.name, warnings: ['interactions empty — enrich from PRD/annotations'] };
  }

  private async captureScreenshot(fileKey: string, node: FigmaNode, screenId: string): Promise<string | undefined> {
    try {
      const images = await this.provider!.getImages(fileKey, [node.id]);
      const url = images[node.id];
      if (!url) return undefined;
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return undefined;
      const buf = Buffer.from(await res.arrayBuffer());
      const p = `${this.cfg.artifactsDir}/screens/${screenId}/design.png`;
      writeJsonFile(p, buf);
      return p;
    } catch (err) {
      log.warn('design-extraction', `screenshot capture failed: ${(err as Error).message}`);
      return undefined;
    }
  }

  private saveSampleScreenshot(screenId: string, spec: Spec): string {
    const buf = renderSpecPng(spec);
    const p = `${this.cfg.artifactsDir}/screens/${screenId}/design.png`;
    writeJsonFile(p, buf);
    return p;
  }
}

function sampleSource(screenId: string): string {
  return `sample-${screenId}`;
}

// minimal fs helpers so this agent doesn't import the whole fs lib
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function writeJsonFile(p: string, buf: Buffer): void {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
}

export { FigmaRestProvider };
export type { FigmaProvider };
