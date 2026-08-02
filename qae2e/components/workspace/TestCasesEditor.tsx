"use client";

import type { Coverage, TestCase } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Pencil, ListChecks, Download, FileSpreadsheet } from "lucide-react";
import { useState } from "react";

export function TestCasesEditor({
  coverage,
  onEdit,
}: {
  coverage: Coverage | null;
  onEdit: (coverage: Coverage) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  if (!coverage) return null;

  const toggle = (id: string) => setOpen(open === id ? null : id);

  const patch = (id: string, updates: Partial<TestCase>) => {
    onEdit({
      ...coverage,
      testCases: coverage.testCases.map((tc) => (tc.id === id ? { ...tc, ...updates } : tc)),
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks size={16} className="text-amber-600" />
        <h3 className="font-semibold text-text-primary">Manual Test Coverage</h3>
        <div className="ml-auto flex items-center gap-1.5">
          <a
            href={`/api/export?coverageId=${coverage.id}&format=csv`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-text-secondary text-xs font-semibold hover:bg-bg-hover"
          >
            <Download size={12} /> CSV
          </a>
          <a
            href={`/api/export?coverageId=${coverage.id}&format=xlsx`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-text-secondary text-xs font-semibold hover:bg-bg-hover"
          >
            <FileSpreadsheet size={12} /> XLSX
          </a>
          <Badge tone="amber">
            {coverage.testCases.length} cases
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        {coverage.testCases.map((tc) => (
          <div key={tc.id} className="rounded-lg border border-border bg-bg-page overflow-hidden">
            <button
              onClick={() => toggle(tc.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover/50 transition-colors"
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  tc.priority === "high" ? "bg-red-500" : tc.priority === "medium" ? "bg-amber-500" : "bg-emerald-500"
                )}
              />
              <span className="flex-1 text-sm font-semibold text-text-primary">{tc.title}</span>
              <Badge tone="default" className="hidden sm:inline-flex">{tc.testType}</Badge>
              <Badge tone={tc.scenarioType === "positive" ? "green" : tc.scenarioType === "negative" ? "red" : "amber"}>
                {tc.scenarioType || "positive"}
              </Badge>
              {open === tc.id ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
            </button>

            {open === tc.id && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {tc.description && <p className="text-sm text-text-secondary">{tc.description}</p>}

                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setEditing(editing === tc.id ? null : tc.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-text-secondary hover:bg-bg-hover transition-colors"
                  >
                    <Pencil size={12} /> {editing === tc.id ? "Done editing" : "Edit"}
                  </button>
                </div>

                {editing === tc.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={tc.description || ""}
                      onChange={(e) => patch(tc.id, { description: e.target.value })}
                      placeholder="Description"
                      rows={2}
                      className="w-full rounded-md border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                    />
                    {tc.steps.map((s, si) => (
                      <div key={si} className="grid grid-cols-2 gap-2">
                        <input
                          value={s.action}
                          onChange={(e) => {
                            const steps = tc.steps.map((x, xi) => (xi === si ? { ...x, action: e.target.value } : x));
                            patch(tc.id, { steps });
                          }}
                          placeholder="Action"
                          className="rounded-md border border-border-input bg-bg-input px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-500"
                        />
                        <input
                          value={s.expected}
                          onChange={(e) => {
                            const steps = tc.steps.map((x, xi) => (xi === si ? { ...x, expected: e.target.value } : x));
                            patch(tc.id, { steps });
                          }}
                          placeholder="Expected"
                          className="rounded-md border border-border-input bg-bg-input px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ol className="space-y-1.5">
                    {tc.steps.map((s, si) => (
                      <li key={si} className="flex gap-2 text-sm text-text-secondary">
                        <span className="font-mono text-xs text-text-muted mt-0.5 shrink-0">{si + 1}.</span>
                        <span>
                          <strong className="text-text-primary font-medium">{s.action}</strong>
                          <span className="text-text-muted"> → </span>
                          <span>{s.expected}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
