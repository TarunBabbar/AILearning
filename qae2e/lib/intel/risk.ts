// Risk-based test selection: given a set of changed files from a PR, pick which
// generated Playwright spec files are impacted, so a run can narrow with --grep
// instead of always running the full suite.

import type { Script } from "../types";

export interface ChangedFile {
  filename: string;
  status?: string;
}

/**
 * Map changed paths to impacted spec files in a generated suite.
 * Heuristic: a spec is impacted when a changed file shares the feature folder
 * (tests/e2e/<feature>/) or the changed file IS a spec.
 */
export function impactedSpecFiles(files: Script["files"], changed: ChangedFile[]): string[] {
  const specs = files.filter((f) => /\.spec\.ts$|\.spec\.js$/.test(f.path));
  if (!specs.length) return [];

  const changedPaths = changed.map((c) => c.filename.replace(/\\/g, "/").toLowerCase());
  if (!changedPaths.length) return [];

  const hit = (specPath: string): boolean => {
    const s = specPath.toLowerCase();
    // Changed file is the spec itself.
    if (changedPaths.some((c) => c.endsWith(s))) return true;
    // Shared feature folder: tests/e2e/login/login.spec.ts vs src/features/login/*.
    const m = s.match(/tests\/e2e\/([^/]+)\//);
    if (m) {
      const feature = m[1];
      return changedPaths.some(
        (c) => c.includes(`/${feature}/`) || c.includes(`${feature}.`) || c.includes(`-${feature}`)
      );
    }
    return false;
  };

  return specs.filter((f) => hit(f.path)).map((f) => f.path);
}

/** Build a --grep filter matching the given spec file paths (or undefined). */
export function grepForSpecs(specPaths: string[]): string | undefined {
  if (!specPaths.length) return undefined;
  const parts = specPaths.map((p) => {
    const base = p.replace(/\\/g, "/").split("/").pop()?.replace(/\.spec\.(ts|js)$/, "") || "";
    return base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  return parts.map((p) => `(?=.*${p})`).join("|");
}

/**
 * Given a run command, append a --grep filter for the impacted specs.
 * Returns the narrowed command, or the original when nothing matched.
 */
export function narrowCommandForDiff(
  command: string,
  files: Script["files"],
  changed: ChangedFile[]
): { command: string; impacted: string[]; note?: string } {
  const impacted = impactedSpecFiles(files, changed);
  if (!impacted.length) {
    return {
      command,
      impacted: [],
      note: "No impacted specs found for the PR diff — running the full suite.",
    };
  }
  const grep = grepForSpecs(impacted);
  if (!grep) return { command, impacted, note: "Could not build a grep filter." };
  return {
    command: `${command} --grep "${grep.replace(/"/g, '\\"')}"`,
    impacted,
    note: `Risk-based selection: running ${impacted.length} impacted spec(s).`,
  };
}
