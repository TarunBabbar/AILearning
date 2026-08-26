import fs from 'node:fs';
import { paths } from './paths';

export interface EnvConfig {
  OPENROUTER_API_KEY: string;
  FIGMA_ACCESS_TOKEN: string;
  FIGMA_FILE_KEY: string;
  STAGING_URL: string;
  MODE: 'live' | 'sample';
  DRY_RUN: boolean;
  DEEPEVAL_MODE: 'mock' | 'server';
  DEEPEVAL_URL: string;
}

export const DEFAULT_ENV: EnvConfig = {
  OPENROUTER_API_KEY: '',
  FIGMA_ACCESS_TOKEN: '',
  FIGMA_FILE_KEY: '',
  STAGING_URL: '',
  MODE: 'live',
  DRY_RUN: true,
  DEEPEVAL_MODE: 'mock',
  DEEPEVAL_URL: 'http://127.0.0.1:8010',
};

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/** Read .env into a typed config (missing keys → defaults / empty). */
export function readEnvConfig(): EnvConfig {
  const raw: Record<string, string> = {};
  try {
    Object.assign(raw, parseEnv(fs.readFileSync(paths.envFile, 'utf-8')));
  } catch {
    /* no .env yet */
  }
  return {
    OPENROUTER_API_KEY: raw.OPENROUTER_API_KEY ?? '',
    FIGMA_ACCESS_TOKEN: raw.FIGMA_ACCESS_TOKEN ?? '',
    FIGMA_FILE_KEY: raw.FIGMA_FILE_KEY ?? '',
    STAGING_URL: raw.STAGING_URL ?? '',
    MODE: (raw.MODE as EnvConfig['MODE']) ?? 'live',
    DRY_RUN: (raw.DRY_RUN ?? 'true') === 'true',
    DEEPEVAL_MODE: (raw.DEEPEVAL_MODE as EnvConfig['DEEPEVAL_MODE']) ?? 'mock',
    DEEPEVAL_URL: raw.DEEPEVAL_URL ?? 'http://127.0.0.1:8010',
  };
}

/** Serialize a config back to .env file format (keeps comments). */
export function writeEnvConfig(cfg: EnvConfig): void {
  const lines = [
    '# --- LLM (OpenRouter) ---',
    `OPENROUTER_API_KEY=${cfg.OPENROUTER_API_KEY}`,
    '',
    '# --- Figma (REST API) ---',
    `FIGMA_ACCESS_TOKEN=${cfg.FIGMA_ACCESS_TOKEN}`,
    `FIGMA_FILE_KEY=${cfg.FIGMA_FILE_KEY}`,
    '',
    '# --- App under test ---',
    `STAGING_URL=${cfg.STAGING_URL}`,
    '',
    '# --- Agents ---',
    `MODE=${cfg.MODE}`,
    `DRY_RUN=${cfg.DRY_RUN}`,
    `DEEPEVAL_MODE=${cfg.DEEPEVAL_MODE}`,
    `DEEPEVAL_URL=${cfg.DEEPEVAL_URL}`,
    '',
  ];
  fs.writeFileSync(paths.envFile, lines.join('\n'), 'utf-8');
}

/** Validate a submitted config. Returns list of errors (empty = valid). */
export function validateEnvConfig(cfg: EnvConfig): string[] {
  const errors: string[] = [];
  if (cfg.MODE === 'live') {
    if (!cfg.OPENROUTER_API_KEY) errors.push('OPENROUTER_API_KEY is required in live mode');
    if (!cfg.FIGMA_ACCESS_TOKEN) errors.push('FIGMA_ACCESS_TOKEN is required in live mode');
    if (!cfg.FIGMA_FILE_KEY) errors.push('FIGMA_FILE_KEY is required in live mode');
    if (!cfg.STAGING_URL) errors.push('STAGING_URL is required in live mode');
    else if (!/^https?:\/\//.test(cfg.STAGING_URL)) errors.push('STAGING_URL must start with http(s)://');
  }
  if (cfg.DEEPEVAL_MODE === 'server' && !/^https?:\/\//.test(cfg.DEEPEVAL_URL)) {
    errors.push('DEEPEVAL_URL must start with http(s)://');
  }
  return errors;
}

/** Mask secret values for the UI (show only whether set + a hint). */
export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `••••••••${value.slice(-4)}`;
}
