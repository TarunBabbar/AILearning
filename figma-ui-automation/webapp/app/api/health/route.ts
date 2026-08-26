import { NextResponse } from 'next/server';
import { readEnvConfig } from '@/lib/env-config';
import fs from 'node:fs';
import { paths } from '@/lib/paths';

export async function GET() {
  const cfg = readEnvConfig();
  return NextResponse.json({
    ok: true,
    hasOpenRouterKey: Boolean(cfg.OPENROUTER_API_KEY),
    hasFigmaToken: Boolean(cfg.FIGMA_ACCESS_TOKEN),
    hasStagingUrl: Boolean(cfg.STAGING_URL),
    deepevalMode: cfg.DEEPEVAL_MODE,
    mode: cfg.MODE,
    dryRun: cfg.DRY_RUN,
    dbExists: fs.existsSync(paths.dbFile),
    envExists: fs.existsSync(paths.envFile),
  });
}
