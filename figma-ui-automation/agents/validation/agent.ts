import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import type { Config } from '../../shared/lib/config.ts';
import { log } from '../../shared/lib/logger.ts';
import { OpenRouterClient } from '../../shared/lib/openrouter.ts';
import { getRouting, type ModelRouting } from '../../shared/lib/models.ts';
import { renderSpecPng, renderSpecDataUri } from './render.ts';
import type { Element, Spec } from '../../shared/types/index.ts';

export interface DriftItem {
  id: string;
  type: 'layout' | 'style' | 'a11y' | 'text' | 'missing' | 'extra' | 'pixel';
  elementId: string;
  elementName: string;
  severity: 'info' | 'minor' | 'major' | 'critical';
  detail: string;
  expected?: unknown;
  actual?: unknown;
}

export interface DriftReport {
  screenId: string;
  designVersion: string;
  createdAt: string;
  summary: {
    totalDeltas: number;
    critical: number;
    major: number;
    minor: number;
    info: number;
    pixelDiffRatio: number;
    verdict: 'match' | 'drift' | 'critical-drift';
  };
  pixel: { diffRatio: number; diffPixels: number; maskedRegions: string[] };
  deltas: DriftItem[];
  judgment?: {
    provider: string;
    summary: string;
    issues: string[];
    verdict: 'match' | 'drift' | 'critical-drift';
  };
}

const MAX_DELTAS = 80;

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.5;
  return false;
}

function fmt(v: unknown): string {
  return v === undefined || v === null || v === '' ? '(none)' : String(v);
}

/**
 * Agent 3 — Validation / Diff.
 * Deterministic layer (pixel + structural token diff) runs first; the LLM vision
 * judgment layer only inspects screenshots when deltas are flagged — keeps spend low.
 */
export class ValidationAgent {
  private cfg: Config;
  private llm: OpenRouterClient;
  private routing: ModelRouting;

  constructor(cfg: Config) {
    this.cfg = cfg;
    this.llm = new OpenRouterClient(this.cfg);
    this.routing = getRouting(this.cfg);
  }

  async run(design: Spec, impl: Spec): Promise<DriftReport> {
    const deltas: DriftItem[] = [];
    const masked: string[] = [];

    const designMap = new Map(design.elements.map((e) => [e.id, e]));
    const implMap = new Map(impl.elements.map((e) => [e.id, e]));

    // --- structural token diff (design vs impl) ---
    for (const d of design.elements) {
      const i = implMap.get(d.id);
      if (!i) {
        deltas.push({ id: `missing-${d.id}`, type: 'missing', elementId: d.id, elementName: d.name, severity: 'major', detail: `Element "${d.name}" (${d.id}) is in the design but not found in the implementation` });
        continue;
      }
      this.diffElement(d, i, deltas);
    }

    // extra elements in impl (not in design) — informational
    for (const i of impl.elements) {
      if (!designMap.has(i.id) && !i.masked) {
        deltas.push({ id: `extra-${i.id}`, type: 'extra', elementId: i.id, elementName: i.name, severity: 'info', detail: `Element "${i.name}" exists in the implementation but not in the design` });
      }
    }

    // --- pixel diff (deterministic) ---
    const designPng = renderSpecPng(design);
    const implPng = readImplPng(this.cfg, design, impl);
    const { diffRatio, diffPixels, maskedRegions } = pixelDiff(designPng, implPng, design, impl);
    masked.push(...maskedRegions);

    if (diffRatio > 0.002) {
      deltas.push({
        id: 'pixel-diff',
        type: 'pixel',
        elementId: 'screen',
        elementName: 'Full screen',
        severity: diffRatio > 0.05 ? 'critical' : diffRatio > 0.01 ? 'major' : 'minor',
        detail: `${(diffRatio * 100).toFixed(2)}% of pixels differ between design and implementation`,
        expected: `${(diffRatio * 100).toFixed(2)}%`,
        actual: '0%',
      });
    }

    // --- verdict ---
    const severityOrder: Record<string, number> = { info: 0, minor: 1, major: 2, critical: 3 };
    const critical = deltas.filter((d) => d.severity === 'critical').length;
    const major = deltas.filter((d) => d.severity === 'major').length;
    const minor = deltas.filter((d) => d.severity === 'minor').length;
    const info = deltas.filter((d) => d.severity === 'info').length;
    const verdict: DriftReport['summary']['verdict'] = critical > 0 ? 'critical-drift' : major > 0 ? 'drift' : 'match';

    const report: DriftReport = {
      screenId: design.screen.id,
      designVersion: design.screen.designVersion ?? 'unknown',
      createdAt: new Date().toISOString(),
      summary: {
        totalDeltas: deltas.length,
        critical,
        major,
        minor,
        info,
        pixelDiffRatio: diffRatio,
        verdict,
      },
      pixel: { diffRatio, diffPixels, maskedRegions: masked },
      deltas: deltas.slice(0, MAX_DELTAS),
    };

    // --- LLM vision judgment layer: only on flagged deltas ---
    if (report.summary.totalDeltas > 0 && this.llm.configured && this.cfg.dryRun === false) {
      report.judgment = await this.visionJudgment(design, impl, report);
    } else {
      report.judgment = {
        provider: this.llm.configured ? 'skipped (dry-run)' : 'skipped (no OPENROUTER_API_KEY)',
        summary: report.summary.verdict,
        issues: [],
        verdict: report.summary.verdict,
      };
    }

    return report;
  }

  private diffElement(d: Element, i: Element, deltas: DriftItem[]): void {
    const base = { elementId: d.id, elementName: d.name };

    // layout
    const dB = d.bounds;
    const iB = i.bounds;
    const layoutDiffs: string[] = [];
    if (Math.abs((dB?.x ?? 0) - (iB?.x ?? 0)) > 2) layoutDiffs.push(`x ${fmt(dB?.x)} → ${fmt(iB?.x)}`);
    if (Math.abs((dB?.y ?? 0) - (iB?.y ?? 0)) > 2) layoutDiffs.push(`y ${fmt(dB?.y)} → ${fmt(iB?.y)}`);
    if (Math.abs((dB?.w ?? 0) - (iB?.w ?? 0)) > 2) layoutDiffs.push(`width ${fmt(dB?.w)} → ${fmt(iB?.w)}`);
    if (Math.abs((dB?.h ?? 0) - (iB?.h ?? 0)) > 2) layoutDiffs.push(`height ${fmt(dB?.h)} → ${fmt(iB?.h)}`);
    if (layoutDiffs.length > 0) deltas.push({ id: `layout-${d.id}`, type: 'layout', severity: 'minor', detail: `Layout drift: ${layoutDiffs.join(', ')}`, expected: `${fmt(dB?.w)}x${fmt(dB?.h)}`, actual: `${fmt(iB?.w)}x${fmt(iB?.h)}`, ...base });

    // text
    const dText = (d.text ?? '').trim();
    const iText = (i.text ?? '').trim();
    if (dText && dText !== iText) deltas.push({ id: `text-${d.id}`, type: 'text', severity: 'major', detail: `Text differs: expected "${dText}", found "${iText || '(empty)'}"`, expected: dText, actual: iText, ...base });

    // styles
    const styleKeys = ['color', 'bg', 'fontSize', 'fontWeight', 'fontFamily', 'radius', 'border'] as const;
    for (const k of styleKeys) {
      const dv = d.styles?.[k];
      const iv = i.styles?.[k];
      if (dv !== undefined && !sameValue(dv, iv)) {
        deltas.push({ id: `style-${d.id}-${k}`, type: 'style', severity: k === 'color' || k === 'bg' ? 'minor' : 'info', detail: `Style "${k}" differs: expected ${fmt(dv)}, found ${fmt(iv)}`, expected: dv, actual: iv, ...base });
      }
    }

    // a11y
    const dLabel = d.a11y?.label;
    const iLabel = i.a11y?.label;
    if (dLabel && dLabel !== iLabel) deltas.push({ id: `a11y-${d.id}`, type: 'a11y', severity: 'major', detail: `Accessible label differs: expected "${dLabel}", found "${iLabel || '(none)'}"`, expected: dLabel, actual: iLabel, ...base });
  }

  private async visionJudgment(design: Spec, impl: Spec, report: DriftReport): Promise<DriftReport['judgment']> {
    const designImg = renderSpecDataUri(design);
    const implImg = renderSpecDataUri(impl);

    const prompt = `You are a senior UI QA engineer. A design spec and a live implementation were compared for the screen "${design.screen.name}".
The deterministic diff found ${report.summary.totalDeltas} deltas (${report.summary.critical} critical, ${report.summary.major} major, ${report.summary.minor} minor).

Deltas:
${report.deltas.map((d) => `- [${d.severity}] ${d.type}: ${d.detail}`).join('\n')}

Look at the design screenshot (first) and the implementation screenshot (second). Judge whether these differences are REAL user-visible drift or false positives (anti-aliasing, dynamic content, acceptable tolerance).

Respond with STRICT JSON only:
{"summary": "1-2 sentence overall assessment", "issues": ["one per real issue, specific"], "verdict": "match" | "drift" | "critical-drift"}`;

    try {
      const res = await this.llm.chatJSON<{ summary: string; issues: string[]; verdict: 'match' | 'drift' | 'critical-drift' }>({
        model: this.routing.validationVision,
        messages: [
          { role: 'system', content: 'You are a precise visual QA judge. Never invent issues that are not visible. Be conservative.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        maxTokens: 800,
        responseFormat: { type: 'json_object' },
      });
      return { provider: this.routing.validationVision, ...res };
    } catch (err) {
      log.warn('validation', `vision judgment failed (${(err as Error).message}); keeping deterministic verdict`);
      return {
        provider: 'failed',
        summary: report.summary.verdict,
        issues: [`Vision judgment unavailable: ${(err as Error).message}`],
        verdict: report.summary.verdict,
      };
    }
  }
}

function readImplPng(cfg: Config, design: Spec, impl: Spec): Buffer {
  const p = `${cfg.artifactsDir}/screens/${impl.screen.id}/impl.png`;
  try {
    return readFileSync(p);
  } catch {
    // fall back to rendering the impl spec (still deterministic)
    return renderSpecPng(impl);
  }
}

function pixelDiff(designPng: Buffer, implPng: Buffer, design: Spec, impl: Spec): { diffRatio: number; diffPixels: number; maskedRegions: string[] } {
  const a = PNG.sync.read(designPng);
  const b = PNG.sync.read(implPng);

  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const diff = new PNG({ width: w, height: h });

  // build mask from masked elements in either spec
  const mask = new Uint8Array(w * h);
  const maskedRegions: string[] = [];
  for (const spec of [design, impl]) {
    for (const el of spec.elements) {
      if (!el.masked) continue;
      const x0 = Math.max(0, Math.floor(el.bounds.x));
      const y0 = Math.max(0, Math.floor(el.bounds.y));
      const x1 = Math.min(w, Math.ceil(el.bounds.x + el.bounds.w));
      const y1 = Math.min(h, Math.ceil(el.bounds.y + el.bounds.h));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) mask[y * w + x] = 1;
      maskedRegions.push(el.id);
    }
  }

  const options = {
    threshold: 0.15,
    includeAA: false,
    alpha: 0.1,
    aaColor: [255, 255, 0] as [number, number, number],
    diffColor: [255, 0, 0] as [number, number, number],
    diffColorAlt: [255, 128, 0] as [number, number, number],
    mask,
  };

  const diffPixels = pixelmatch(a.data, b.data, diff.data, w, h, options);

  // normalize diff ratio against unmasked pixel count
  const unmasked = mask.reduce((acc, m) => acc + (m === 0 ? 1 : 0), 0);
  const diffRatio = unmasked > 0 ? diffPixels / unmasked : 0;

  return { diffRatio, diffPixels, maskedRegions };
}
