// Shared checks for generated Playwright automation artifacts.

import type { Script } from "../types";

export type ScriptFile = { path: string; code: string };

/** Normalize LLM file payloads: accept code|content, stringify objects. */
export function normalizeScriptFiles(raw: unknown): ScriptFile[] {
  if (!Array.isArray(raw)) return [];
  const out: ScriptFile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const path = String(rec.path || rec.file || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path) continue;
    let code = rec.code ?? rec.content ?? rec.source ?? "";
    if (code != null && typeof code === "object") {
      try {
        code = JSON.stringify(code, null, 2);
      } catch {
        code = String(code);
      }
    }
    const text = String(code ?? "");
    out.push({ path, code: text });
  }
  return out;
}

export function listPaths(files: ScriptFile[]): string[] {
  return files.map((f) => f.path.replace(/\\/g, "/").toLowerCase());
}

/** True when the artifact can actually execute tests (POM or at least one spec). */
export function isRunnableAutomation(files: ScriptFile[]): {
  ok: boolean;
  reason?: string;
  hasSpec: boolean;
  hasPage: boolean;
  hasConfig: boolean;
} {
  const paths = listPaths(files);
  const hasSpec = paths.some((p) => p.endsWith(".spec.ts") || p.endsWith(".spec.js") || /\/tests\/.+\.ts$/.test(p));
  const hasPage = paths.some((p) => p.includes("/pages/") && p.endsWith(".ts") && !p.endsWith("index.ts"));
  const hasConfig = paths.some((p) => p === "playwright.config.ts" || p.endsWith("/playwright.config.ts"));
  const emptyOrTruncated = files.filter((f) => {
    const t = (f.code || "").trim();
    if (t.length < 8) return true;
    const p = f.path.replace(/\\/g, "/").toLowerCase();
    // LLM truncation signature: package.json / tsconfig that is just "{"
    if ((p.endsWith("package.json") || p.endsWith("tsconfig.json")) && t.length < 40) return true;
    if (p.endsWith(".ts") && t.length < 50) return true;
    return false;
  });

  if (!files.length) return { ok: false, reason: "no files", hasSpec, hasPage, hasConfig };
  if (emptyOrTruncated.length) {
    return {
      ok: false,
      reason: `truncated/empty files: ${emptyOrTruncated.map((f) => f.path).join(", ")}`,
      hasSpec,
      hasPage,
      hasConfig,
    };
  }
  if (!hasSpec) {
    return {
      ok: false,
      reason: "missing tests/**/*.spec.ts — config-only saves are rejected",
      hasSpec,
      hasPage,
      hasConfig,
    };
  }
  return { ok: true, hasSpec, hasPage, hasConfig };
}

export function summarizeScript(script: Script): string {
  const check = isRunnableAutomation(script.files);
  return `${script.files.length} file(s); runnable=${check.ok}${check.reason ? ` (${check.reason})` : ""}`;
}
