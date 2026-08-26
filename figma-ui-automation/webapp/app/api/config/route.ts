import { NextResponse } from 'next/server';
import { readEnvConfig, writeEnvConfig, validateEnvConfig, type EnvConfig } from '@/lib/env-config';

export async function GET() {
  const cfg = readEnvConfig();
  return NextResponse.json(cfg);
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<EnvConfig>;
  const current = readEnvConfig();

  const next: EnvConfig = {
    OPENROUTER_API_KEY: typeof body.OPENROUTER_API_KEY === 'string' ? body.OPENROUTER_API_KEY : current.OPENROUTER_API_KEY,
    FIGMA_ACCESS_TOKEN: typeof body.FIGMA_ACCESS_TOKEN === 'string' ? body.FIGMA_ACCESS_TOKEN : current.FIGMA_ACCESS_TOKEN,
    FIGMA_FILE_KEY: typeof body.FIGMA_FILE_KEY === 'string' ? body.FIGMA_FILE_KEY : current.FIGMA_FILE_KEY,
    STAGING_URL: typeof body.STAGING_URL === 'string' ? body.STAGING_URL : current.STAGING_URL,
    MODE: body.MODE === 'live' || body.MODE === 'sample' ? body.MODE : current.MODE,
    DRY_RUN: typeof body.DRY_RUN === 'boolean' ? body.DRY_RUN : current.DRY_RUN,
    DEEPEVAL_MODE: body.DEEPEVAL_MODE === 'mock' || body.DEEPEVAL_MODE === 'server' ? body.DEEPEVAL_MODE : current.DEEPEVAL_MODE,
    DEEPEVAL_URL: typeof body.DEEPEVAL_URL === 'string' ? body.DEEPEVAL_URL : current.DEEPEVAL_URL,
  };

  const errors = validateEnvConfig(next);
  if (errors.length > 0) return NextResponse.json({ error: errors.join('; ') }, { status: 400 });

  writeEnvConfig(next);
  return NextResponse.json({ ok: true, saved: { mode: next.MODE, dryRun: next.DRY_RUN, deepevalMode: next.DEEPEVAL_MODE } });
}
