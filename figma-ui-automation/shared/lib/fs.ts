import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

export function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true });
}

export function writeJson(p: string, data: unknown): void {
  ensureDir(dirname(p));
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

export function readJson<T = unknown>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf-8')) as T;
}

export function readText(p: string): string {
  return readFileSync(p, 'utf-8');
}

export function writeText(p: string, text: string): void {
  ensureDir(dirname(p));
  writeFileSync(p, text, 'utf-8');
}

export function exists(p: string): boolean {
  return existsSync(p);
}

/**
 * Copy a data URI PNG (or any base64 blob) to a file under the given dir,
 * returning the file path.
 */
export function saveDataUri(dataUri: string, dir: string, filename: string): string {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUri);
  if (!m) throw new Error('Not a data:image/png URI');
  const p = join(dir, filename);
  ensureDir(dir);
  writeFileSync(p, Buffer.from(m[1], 'base64'));
  return p;
}

export function toDataUri(buffer: Buffer): string {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}
