"use client";

import { useEffect, useMemo, useState } from "react";
import { CONNECTORS } from "@/lib/connectors/defs";
import type { ConnectorId, ConnectorStatus } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";

export function ConnectorsPanel() {
  const [statuses, setStatuses] = useState<ConnectorStatus[] | null>(null);
  const [selected, setSelected] = useState<ConnectorId | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((d) => setStatuses(d.connectors))
      .catch(() => setStatuses([]));
  }, []);

  const def = useMemo(() => CONNECTORS.find((c) => c.id === selected) || null, [selected]);
  const statusFor = (id: ConnectorId) => statuses?.find((s) => s.id === id);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", connector: selected, fields: values }),
      });
      const d = await res.json();
      setTestResult({ ok: d.ok, detail: d.detail || "Test complete" });
    } catch (err) {
      setTestResult({ ok: false, detail: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const saveConnector = async () => {
    setSaved(false);
    try {
      await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", connector: selected, fields: values }),
      });
      setSaved(true);
    } catch {
      setSaved(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Plug size={16} className="text-amber-600" />
        <h3 className="font-semibold text-text-primary">Connectors</h3>
        <span className="text-xs text-text-muted ml-auto">
          Connect Jira · Confluence · Figma · GitHub · Zephyr · TestRail
        </span>
      </div>

      {/* Connector chips */}
      <div className="flex flex-wrap gap-2">
        {CONNECTORS.map((c) => {
          const st = statusFor(c.id);
          return (
            <button
              key={c.id}
              onClick={() => {
                setSelected(c.id);
                setValues({});
                setTestResult(null);
                setSaved(false);
              }}
              className={cn(
                "px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors flex items-center gap-1.5",
                selected === c.id
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-700"
                  : "border-border bg-bg-page text-text-secondary hover:bg-bg-hover"
              )}
            >
              {st?.configured ? <CheckCircle2 size={12} className="text-emerald-600" /> : <XCircle size={12} className="text-text-muted" />}
              {c.name}
            </button>
          );
        })}
      </div>

      {statuses && (
        <div className="mt-3 text-xs text-text-muted space-y-1">
          {CONNECTORS.map((c) => {
            const st = statusFor(c.id);
            return (
              <p key={c.id}>
                <span className="font-semibold text-text-secondary">{c.name}:</span>{" "}
                {st?.configured ? (
                  <span className="text-emerald-700">configured ✓</span>
                ) : (
                  <span>missing {st?.missing.join(", ") || "credentials"}</span>
                )}
              </p>
            );
          })}
        </div>
      )}

      {/* Selected connector form */}
      {def && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-sm font-semibold text-text-primary">{def.name}</p>
          <p className="text-xs text-text-muted mt-0.5">{def.description}</p>
          <div className="mt-3 space-y-2.5">
            {def.fields.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs font-semibold text-text-secondary">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </span>
                <input
                  type={f.type === "password" ? "password" : "text"}
                  value={values[f.key] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="mt-1 w-full rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="block text-[11px] text-text-muted mt-0.5">{f.description}</span>
              </label>
            ))}
          </div>

          {testResult && (
            <p className={cn("mt-2 text-xs", testResult.ok ? "text-emerald-700" : "text-red-600")}>
              {testResult.ok ? "✓ " : "✗ "}{testResult.detail}
            </p>
          )}
          {saved && <p className="mt-2 text-xs text-emerald-700">Saved to .env (applies on next restart).</p>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={testConnection}
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50"
            >
              {testing && <Loader2 size={12} className="animate-spin" />}
              {testing ? "Testing…" : "Test connection"}
            </button>
            <button
              onClick={saveConnector}
              className="px-3 py-1.5 rounded-md border border-border text-text-secondary text-xs font-semibold hover:bg-bg-hover"
            >
              Save to .env
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
