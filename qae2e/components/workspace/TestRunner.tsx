"use client";

import { useRef, useState } from "react";
import type { Coverage } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { Play, Loader2, Upload, ScanText, CheckCircle2, XCircle, Square } from "lucide-react";

interface RunSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
}

// Events emitted by /api/run (NDJSON) — distinct from AgentEvent.
type RunEvent =
  | { type: "status"; message: string }
  | { type: "log"; text: string }
  | { type: "result"; summary: RunSummary; exitCode: number | null }
  | { type: "done" }
  | { type: "error"; message: string };

export function TestRunner({
  requirementId,
  coverage,
  workspaceId = "",
  onRequirementText,
}: {
  requirementId: string | null;
  coverage: Coverage | null;
  workspaceId?: string;
  onRequirementText: (text: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [command, setCommand] = useState("npx --yes playwright@1.51.0 test --project=chromium");
  const [repoUrl, setRepoUrl] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [testrailRunId, setTestrailRunId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    if (!requirementId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setEvents([]);
    setSummary(null);
    setLastError(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId, workspaceId, command, repoUrl: repoUrl || undefined, jiraProjectKey: jiraProjectKey || undefined, testrailRunId: testrailRunId ? Number(testrailRunId) : undefined }),
        signal: controller.signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: RunEvent;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          setEvents((prev) => [...prev, ev]);
          if (ev.type === "error") setLastError(ev.message);
          if (ev.type === "result") {
            setSummary(ev.summary as unknown as RunSummary);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setEvents((prev) => [...prev, { type: "error", message: String(err) }]);
        setLastError(String(err));
      }
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setExtracted(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (requirementId) fd.append("requirementId", requirementId);
      if (workspaceId) fd.append("workspaceId", workspaceId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (d.ok && d.text) {
        setExtracted(d.text);
        onRequirementText(d.text);
      } else {
        setExtracted(`Error: ${d.error || "extraction failed"}`);
      }
    } catch (err) {
      setExtracted(`Error: ${String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Local Docker run */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <Play size={16} className="text-amber-600" />
          <h3 className="font-semibold text-text-primary">Run tests locally (Docker)</h3>
        </div>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Command (default: npx playwright test --project=chromium)"
          className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500"
        />
        <p className="mt-1.5 text-xs text-text-muted">
          The runner first checks Docker + the Playwright image (pulls it if missing), then verifies node/npm
          inside the container, runs <code className="font-mono">npm install</code> when <code className="font-mono">node_modules</code> is
          missing, and installs <code className="font-mono">playwright install chromium</code> when the browser is not present.
          For a local run, leave the repo URL empty — the saved scripts are materialized automatically.
        </p>
        <input
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Optional repo URL to clone + run (e.g. https://github.com/org/repo.git)"
          className="mt-2 w-full rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500"
        />
        <div className="mt-2 grid sm:grid-cols-2 gap-2">
          <input
            value={jiraProjectKey}
            onChange={(e) => setJiraProjectKey(e.target.value)}
            placeholder="Jira project key (raise defect on failure)"
            className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <input
            value={testrailRunId}
            onChange={(e) => setTestrailRunId(e.target.value)}
            placeholder="TestRail run ID (post results)"
            type="number"
            className="w-full rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="mt-3 flex gap-2">
          {running ? (
            <button onClick={stop} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500 text-white text-xs font-semibold">
              <Square size={12} /> Stop
            </button>
          ) : (
            <button
              onClick={run}
              disabled={!requirementId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
            >
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Run tests
            </button>
          )}
        </div>
        {!requirementId && <p className="mt-2 text-xs text-text-muted">Run the pipeline first to get a requirement.</p>}
        {lastError && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700">
            <p className="font-semibold mb-0.5">Tests could not run</p>
            <p className="whitespace-pre-wrap">{lastError}</p>
          </div>
        )}

        {summary && (
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            <Metric label="Passed" value={summary.passed} tone="text-emerald-700" />
            <Metric label="Failed" value={summary.failed} tone="text-red-600" />
            <Metric label="Skipped" value={summary.skipped} tone="text-text-muted" />
            <Metric label="Total" value={summary.total} tone="text-text-primary" />
          </div>
        )}

        {events.length > 0 && (
          <div className="mt-4 max-h-[240px] overflow-y-auto rounded-lg border border-border bg-bg-code p-3 font-mono text-[11px] text-[#e8e0d1] space-y-1">
            {events.map((e, i) => (
              <p key={i} className={cn("whitespace-pre-wrap", e.type === "error" && "text-red-400", e.type === "result" && "text-emerald-400")}>
                {e.type === "status"
                  ? `▸ ${e.message}`
                  : e.type === "log"
                    ? e.text
                    : e.type === "result"
                      ? `✓ passed=${e.summary.passed} failed=${e.summary.failed} skipped=${e.summary.skipped} total=${e.summary.total} exit=${e.exitCode ?? "?"}`
                      : e.type === "error"
                        ? `✗ ${e.message}`
                        : e.type === "done"
                          ? "· done"
                          : `· ${JSON.stringify(e)}`}
              </p>
            ))}
          </div>
        )}
      </Card>

      {/* Image upload → vision extraction */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <ScanText size={16} className="text-amber-600" />
          <h3 className="font-semibold text-text-primary">Extract requirement from image</h3>
        </div>
        <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border text-sm text-text-secondary hover:bg-bg-hover cursor-pointer">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Extracting text…" : "Upload a PRD / Figma screenshot"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
        </label>
        {extracted && (
          <div className="mt-3 rounded-lg border border-border bg-bg-page p-3 text-sm text-text-secondary whitespace-pre-wrap max-h-[200px] overflow-y-auto">
            {extracted}
          </div>
        )}
        {coverage && <p className="mt-2 text-xs text-text-muted">Coverage ready: {coverage.testCases.length} cases.</p>}
      </Card>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-page p-2.5">
      <p className={cn("text-lg font-bold", tone)}>{value}</p>
      <p className="text-[11px] text-text-muted">{label}</p>
    </div>
  );
}
