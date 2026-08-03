"use client";

import type { Script } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Copy, Check, FileCode2, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function fileText(code: unknown): string {
  if (typeof code === "string") return code;
  if (code == null) return "";
  if (typeof code === "object") {
    try {
      return JSON.stringify(code, null, 2);
    } catch {
      return String(code);
    }
  }
  return String(code);
}

export function ScriptView({
  script,
  waiting,
}: {
  script: Script | null;
  /** Show empty-state card when coverage exists but scripts not yet saved. */
  waiting?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const files = useMemo(
    () =>
      (script?.files || []).map((f) => ({
        path: f.path || "untitled",
        code: fileText(f.code),
      })),
    [script]
  );

  useEffect(() => {
    setActive(0);
  }, [script?.id]);

  if (!script) {
    if (!waiting) return null;
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileCode2 size={16} className="text-amber-600" />
          <h3 className="font-semibold text-text-primary">Automation scripts</h3>
        </div>
        <p className="text-sm text-text-secondary">
          No Playwright scripts saved yet. Agent 3 (AS) must call <code className="font-mono text-xs">coverage_get</code> then{" "}
          <code className="font-mono text-xs">script_save</code> with a full POM scaffold (pages + specs).
        </p>
      </Card>
    );
  }

  const hasSpec = files.some((f) => /\.spec\.(ts|js)$/i.test(f.path) || /\/tests\//i.test(f.path));
  const file = files[Math.min(active, Math.max(files.length - 1, 0))];

  const copy = async (path: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(path);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FileCode2 size={16} className="text-amber-600" />
        <h3 className="font-semibold text-text-primary">Automation scripts</h3>
        <Badge tone="amber" className="capitalize">
          {script.framework}
        </Badge>
        <span className="text-xs text-text-muted ml-auto font-mono">
          {files.length} file{files.length === 1 ? "" : "s"} · {script.language}
        </span>
      </div>

      {!hasSpec && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Config-only save detected (no <code className="font-mono">*.spec.ts</code>). Docker will find 0 tests. Re-run the
            pipeline — AS must include pages + specs, or the POM fallback will generate them.
          </span>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 max-h-28 overflow-y-auto">
          {files.map((f, i) => (
            <button
              key={`${f.path}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              title={`${f.path} (${f.code.length} chars)`}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
                i === active
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-700"
                  : "border-border text-text-muted hover:bg-bg-hover"
              }`}
            >
              {f.path}
              <span className="ml-1 opacity-60">{f.code.length ? `${Math.round(f.code.length / 1024) || "<1"}k` : "empty"}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="absolute top-3 left-3 right-24 text-[10px] font-mono text-[#a89f8f] truncate pointer-events-none">
          {file?.path}
          {file ? ` · ${file.code.length} chars` : ""}
        </div>
        <button
          type="button"
          onClick={() => file && copy(file.path, file.code)}
          disabled={!file?.code}
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-black/40 text-[#e8e0d1] text-xs hover:bg-black/55 transition-colors disabled:opacity-40"
        >
          {copied === file?.path ? <Check size={12} /> : <Copy size={12} />}
          {copied === file?.path ? "Copied" : "Copy"}
        </button>
        <pre className="rounded-lg bg-bg-code p-4 pt-12 overflow-x-auto max-h-[480px] overflow-y-auto text-[#e8e0d1] text-xs leading-relaxed font-mono whitespace-pre">
          <code>{file?.code?.trim() ? file.code : "// empty or truncated file — AS must send full source in script_save.code"}</code>
        </pre>
      </div>
    </Card>
  );
}
