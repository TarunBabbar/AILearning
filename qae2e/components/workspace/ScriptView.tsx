"use client";

import type { Script } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Copy, Check, FileCode2 } from "lucide-react";
import { useState } from "react";

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
          <code className="font-mono text-xs">script_save</code>. GitHub is optional — standalone specs are enough for local Docker.
        </p>
      </Card>
    );
  }

  const copy = async (path: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(path);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  const file = script.files[active];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FileCode2 size={16} className="text-amber-600" />
        <h3 className="font-semibold text-text-primary">Automation scripts</h3>
        <Badge tone="amber" className="capitalize">
          {script.framework}
        </Badge>
        <span className="text-xs text-text-muted ml-auto font-mono">
          {script.files.length} file{script.files.length === 1 ? "" : "s"} · {script.language}
        </span>
      </div>

      {script.files.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {script.files.map((f, i) => (
            <button
              key={f.path}
              onClick={() => setActive(i)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-colors ${
                i === active
                  ? "bg-amber-500/10 border-amber-500/40 text-amber-700"
                  : "border-border text-text-muted hover:bg-bg-hover"
              }`}
            >
              {f.path}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => file && copy(file.path, file.code)}
          className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-code text-[#e8e0d1] text-xs hover:bg-opacity-80 transition-colors"
        >
          {copied === file?.path ? <Check size={12} /> : <Copy size={12} />}
          {copied === file?.path ? "Copied" : "Copy"}
        </button>
        <pre className="rounded-lg bg-bg-code p-4 pt-12 overflow-x-auto text-[#e8e0d1] text-xs leading-relaxed font-mono">
          <code>{file?.code || "// empty file"}</code>
        </pre>
      </div>
    </Card>
  );
}
