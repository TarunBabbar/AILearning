// Build a downloadable ZIP bundle for a run: generated automation code, run
// logs, JUnit-style results, and a summary README. Uses jszip (pure JS, works
// in Node serverless — Vercel compatible).

import JSZip from "jszip";
import type { RunRecord } from "./store";

function summaryMarkdown(r: RunRecord): string {
  const lines = [
    `# QAE2E Run — ${r.title}`,
    "",
    `- **Run ID:** ${r.id}`,
    `- **Requirement ID:** ${r.requirementId}`,
    `- **Source:** ${r.source}`,
    `- **Started:** ${r.startedAt}`,
    `- **Finished:** ${r.finishedAt}`,
    `- **Status:** ${r.status}`,
    "",
    "## Agents",
    ...r.agents.map((a) => `- **${a.code}**: ${a.status}`),
    "",
    "## Artifacts",
    `- Analyses: ${r.counts.analyses}`,
    `- Coverages: ${r.counts.coverages}`,
    `- Test cases: ${r.counts.testCases}`,
    `- Scripts: ${r.counts.scripts}`,
    `- Cycles: ${r.counts.cycles}`,
    `- Defects: ${r.counts.defects}`,
    `- Releases: ${r.counts.releases}`,
  ];

  if (r.testRun) {
    const t = r.testRun;
    lines.push(
      "",
      "## Test run (Docker)",
      `- Passed: ${t.passed}`,
      `- Failed: ${t.failed}`,
      `- Skipped: ${t.skipped}`,
      `- Total: ${t.total}`,
      `- Attempts: ${t.attempts}`,
      `- Result: ${t.ok ? "PASS" : "FAIL"}`
    );
    if (t.failures.length) {
      lines.push("", "### Failures", ...t.failures.map((f) => `- ${f.test}: ${f.message.slice(0, 300)}`));
    }
  }

  if (r.issues.length) {
    lines.push("", "## Issues", ...r.issues.map((i) => `- ${i}`));
  }

  lines.push("", "## Run log", "```", ...serializeEvents(r.events).split("\n"), "```");
  return lines.join("\n");
}

export function serializeEvents(events: unknown[]): string {
  const lines: string[] = [];
  for (const raw of events) {
    const e = raw as Record<string, unknown>;
    switch (e.type) {
      case "agent_start":
        lines.push(`\n=== Agent ${Number(e.index) + 1}/${e.total}: ${e.code} — ${e.name} [started] ===`);
        break;
      case "agent_done":
        lines.push(`--- Agent ${Number(e.index) + 1}/${e.total}: ${e.code} — done ---`);
        break;
      case "status":
        lines.push(`[status] ${e.message}`);
        break;
      case "tool_call":
        lines.push(`→ call ${e.tool}`);
        if (e.args && Object.keys(e.args as object).length) lines.push(`  args: ${JSON.stringify(e.args)}`);
        break;
      case "tool_result":
        lines.push(`← ${e.tool}: ${e.summary}`);
        if (e.text) lines.push(`  full: ${String(e.text)}`);
        break;
      case "artifact":
        lines.push(`[artifact] ${e.artifact} (${e.id})`);
        break;
      case "chunk":
        lines.push(`[output]\n${e.text}`);
        break;
      case "error":
        lines.push(`[error] ${e.message}`);
        break;
      default:
        lines.push(`[event] ${JSON.stringify(e)}`);
    }
  }
  return lines.join("\n");
}

/** Build a ZIP buffer for a run. */
export async function buildRunZip(r: RunRecord): Promise<Buffer> {
  const zip = new JSZip();

  // Generated automation code.
  const files = zip.folder("automation")!;
  for (const f of r.files) {
    files.file(f.path, f.code);
  }
  // A minimal package.json so the bundle is runnable.
  files.file(
    "package.json",
    JSON.stringify(
      { name: "qae2e-run", private: true, version: "1.0.0", dependencies: { "@playwright/test": "^1.51.0" }, scripts: { test: "playwright test --project=chromium" } },
      null,
      2
    )
  );

  // Logs.
  zip.file("run.log", serializeEvents(r.events));
  if (r.testRun?.logs.length) zip.file("test-run.log", r.testRun.logs.join("\n"));

  // Results.
  if (r.testRun) {
    zip.file(
      "test-results.json",
      JSON.stringify({ ok: r.testRun.ok, passed: r.testRun.passed, failed: r.testRun.failed, skipped: r.testRun.skipped, total: r.testRun.total, attempts: r.testRun.attempts, failures: r.testRun.failures }, null, 2)
    );
  }

  zip.file("README.md", summaryMarkdown(r));

  return zip.generateAsync({ type: "nodebuffer" });
}
