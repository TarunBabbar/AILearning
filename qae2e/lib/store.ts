// JSON file persistence for artifacts. Falls back to in-memory Maps when
// the filesystem is unavailable (e.g. serverless).

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getConfig } from "./config";

type StoreShape = Record<string, unknown[]>;

const memory = new Map<string, unknown[]>();

function dataFilePath(): string {
  return join(process.cwd(), getConfig().dataDir, "artifacts.json");
}

function ensureDataDir(): void {
  try {
    mkdirSync(join(process.cwd(), getConfig().dataDir), { recursive: true });
  } catch {
    // read-only fs — memory fallback used
  }
}

export function readAll<T>(key: string): T[] {
  const cached = memory.get(key);
  if (cached) return cached as T[];

  try {
    const raw = readFileSync(dataFilePath(), "utf-8");
    const all = JSON.parse(raw) as StoreShape;
    return (all[key] || []) as T[];
  } catch {
    return [];
  }
}

export function writeAll<T>(key: string, items: T[]): void {
  memory.set(key, items);

  try {
    ensureDataDir();
    let all: StoreShape = {};
    try {
      all = JSON.parse(readFileSync(dataFilePath(), "utf-8")) as StoreShape;
    } catch {
      // fresh file
    }
    all[key] = items;
    writeFileSync(dataFilePath(), JSON.stringify(all, null, 2), "utf-8");
  } catch {
    // memory-only mode
  }
}

export function insertOne<T extends { id: string }>(key: string, item: T): T {
  const items = readAll<T>(key);
  items.push(item);
  writeAll(key, items);
  return item;
}

export function updateOne<T extends { id: string }>(key: string, item: T): T {
  const items = readAll<T>(key).map((i) => (i.id === item.id ? item : i));
  writeAll(key, items);
  return item;
}

export function getOne<T extends { id: string }>(key: string, id: string): T | undefined {
  return readAll<T>(key).find((i) => i.id === id);
}

export function listAll<T extends { id: string }>(key: string): T[] {
  return readAll<T>(key);
}

export function clearAll(): void {
  memory.clear();
  try {
    ensureDataDir();
    writeFileSync(dataFilePath(), "{}", "utf-8");
  } catch {
    // memory-only mode
  }
}

export const exists = existsSync;
