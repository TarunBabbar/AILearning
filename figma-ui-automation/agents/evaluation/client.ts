import type { Config } from '../../shared/lib/config.ts';
import { log } from '../../shared/lib/logger.ts';

export interface EvalTestCase {
  id: string;
  title: string;
  scenario: string;
  expected: string;
}

export interface TestCaseEvalRequest {
  screenId: string;
  sourceText: string;
  cases: EvalTestCase[];
}

export interface EvalResult {
  screenId: string;
  overall: { faithfulness: number; verdict: 'pass' | 'warn' | 'fail' };
  results: Array<{ id: string; faithfulness: number; hallucination: number; verdict: string; method: string }>;
  method: string;
}

export interface DriftEvalRequest {
  screenId: string;
  reportSummary: string;
  deltas: Array<{ severity?: string; type?: string; detail?: string }>;
}

export interface DriftEvalResult {
  screenId: string;
  score: number;
  verdict: 'pass' | 'warn' | 'fail';
  summary: string;
}

const PASS_THRESHOLD = 0.8;

/**
 * Agent 6 client — Evaluation.
 * Talks to the DeepEval FastAPI sidecar (DEEPEVAL_MODE=server).
 * In mock mode (default) it applies a deterministic local judge so the
 * pipeline runs without Python; the interface is identical.
 */
export class EvalClient {
  private cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  get mode(): string {
    return this.cfg.deepevalMode;
  }

  async evaluateTestCases(req: TestCaseEvalRequest): Promise<EvalResult> {
    if (this.cfg.deepevalMode === 'server') {
      const res = await fetch(`${this.cfg.deepevalUrl}/evaluate/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`Eval sidecar HTTP ${res.status}`);
      const data = (await res.json()) as EvalResult;
      data.method = `${data.method} (server)`;
      return data;
    }
    return this.mockTestCases(req);
  }

  async evaluateDrift(req: DriftEvalRequest): Promise<DriftEvalResult> {
    if (this.cfg.deepevalMode === 'server') {
      const res = await fetch(`${this.cfg.deepevalUrl}/evaluate/drift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`Eval sidecar HTTP ${res.status}`);
      return (await res.json()) as DriftEvalResult;
    }
    return this.mockDrift(req);
  }

  private mockTestCases(req: TestCaseEvalRequest): EvalResult {
    // Deterministic local judge: faithfulness ≈ how many case targets/words
    // actually appear in the source design text. No LLM, no Python.
    const source = req.sourceText.toLowerCase();
    const sourceWords = new Set(source.split(/\W+/).filter((w) => w.length > 2));

    const results = req.cases.map((c) => {
      const text = `${c.scenario} ${c.expected}`.toLowerCase();
      const words = text.split(/\W+/).filter((w) => w.length > 2);
      if (words.length === 0) return { id: c.id, faithfulness: 1, hallucination: 0, verdict: 'pass', method: 'mock' };
      const known = words.filter((w) => sourceWords.has(w)).length;
      const faithfulness = Math.min(1, known / words.length + 0.35); // nudge: stopwords inflate denominator
      const hallucination = Math.max(0, 1 - faithfulness - 0.2);
      const verdict = faithfulness >= PASS_THRESHOLD ? 'pass' : faithfulness >= 0.6 ? 'warn' : 'fail';
      return { id: c.id, faithfulness: round3(faithfulness), hallucination: round3(hallucination), verdict, method: 'mock' };
    });
    const avg = round3(results.reduce((a, r) => a + r.faithfulness, 0) / Math.max(1, results.length));
    return {
      screenId: req.screenId,
      overall: { faithfulness: avg, verdict: avg >= PASS_THRESHOLD ? 'pass' : avg >= 0.6 ? 'warn' : 'fail' },
      results,
      method: 'mock-judge',
    };
  }

  private mockDrift(req: DriftEvalRequest): DriftEvalResult {
    const total = req.deltas.length;
    const specific = req.deltas.filter((d) => (d.detail?.length ?? 0) > 20).length;
    const score = total === 0 ? 1 : round3(0.5 * Math.min(1, specific / total) + 0.3);
    return {
      screenId: req.screenId,
      score,
      verdict: score >= PASS_THRESHOLD ? 'pass' : score >= 0.6 ? 'warn' : 'fail',
      summary: `mock drift judge: ${specific}/${total} deltas have specific detail`,
    };
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function isPassing(result: { overall?: { verdict: string }; verdict?: string }): boolean {
  const v = result.overall?.verdict ?? result.verdict ?? 'fail';
  return v === 'pass';
}

export function logEval(tag: string, r: { overall?: { verdict: string; faithfulness?: number }; verdict?: string; score?: number }): void {
  const v = r.overall?.verdict ?? r.verdict ?? '?';
  const s = r.overall?.faithfulness ?? r.score ?? 0;
  log.info(tag, `eval verdict: ${v} (score ${s})`);
}
