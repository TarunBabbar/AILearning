import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from './config.ts';
import { log } from './logger.ts';

/** Model routing table — cheap/no-LLM for deterministic steps, reasoning models only where needed. */
export interface ModelRouting {
  designExtraction: string;
  implInspection: string;
  validationVision: string;
  testCaseGen: string;
  automationCodegen: string;
  evaluation: string;
}

const DEFAULT_ROUTING: ModelRouting = {
  designExtraction: 'google/gemini-2.5-flash-lite',
  implInspection: 'google/gemini-2.5-flash-lite',
  validationVision: 'anthropic/claude-3.5-sonnet',
  testCaseGen: 'anthropic/claude-3.5-sonnet',
  automationCodegen: 'anthropic/claude-3.5-sonnet',
  evaluation: 'google/gemini-2.5-flash-lite',
};

function loadRouting(cfg: Config): ModelRouting {
  const p = join(cfg.rootDir, 'agents/model-routing.json');
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as Partial<ModelRouting>;
    return { ...DEFAULT_ROUTING, ...parsed };
  } catch {
    return { ...DEFAULT_ROUTING };
  }
}

export function getRouting(cfg: Config): ModelRouting {
  return loadRouting(cfg);
}
