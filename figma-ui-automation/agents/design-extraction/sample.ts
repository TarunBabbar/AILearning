import { FIGMA_SAMPLE } from './sample-data.ts';
import type { Spec } from '../../shared/types/index.ts';

const SAMPLES: Record<string, Spec> = {};
for (const s of FIGMA_SAMPLE) SAMPLES[s.screen.id] = s;

export function getSampleSpec(screenId: string): Spec | undefined {
  return SAMPLES[screenId];
}

export function listSampleScreenIds(): string[] {
  return Object.keys(SAMPLES);
}
