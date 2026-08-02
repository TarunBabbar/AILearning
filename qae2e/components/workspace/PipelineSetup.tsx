"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Settings2, ChevronDown, Github, Bug, FlaskConical, Container, KeyRound } from "lucide-react";

export interface SetupValues {
  // Source (connector)
  sourceKey?: string;
  // GitHub (AS agent check-in)
  githubToken?: string;
  githubOwner?: string;
  githubRepo?: string;
  // Jira (defect sync)
  jiraProjectKey?: string;
  // TestRail (result sync)
  testrailRunId?: string;
  // Docker (local run)
  dockerImage?: string;
}

/**
 * One-shot intake form shown before the pipeline runs. Everything is optional —
 * skip all and the pipeline still runs end-to-end on local results.
 */
export function PipelineSetup({
  onRun,
  onStop,
  running,
}: {
  onRun: (v: SetupValues) => void;
  onStop?: () => void;
  running: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<SetupValues>({});
  const set = (k: keyof SetupValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  const Field = ({
    label,
    icon,
    value,
    onChange,
    placeholder,
    type = "text",
    hint,
  }: {
    label: string;
    icon: React.ReactNode;
    value?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: string;
    hint?: string;
  }) => (
    <label className="block">
      <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
        {icon} {label}
      </span>
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
      />
      {hint && <span className="block text-[11px] text-text-muted mt-0.5">{hint}</span>}
    </label>
  );

  return (
    <Card className="p-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between"
        type="button"
      >
        <span className="flex items-center gap-2 font-semibold text-text-primary">
          <Settings2 size={16} className="text-amber-600" />
          Optional configuration — provide anything, or skip all
        </span>
        <ChevronDown size={16} className={cn("text-text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Source key / ID (Jira key, Confluence page ID, Figma file key)" icon={<KeyRound size={12} />} value={v.sourceKey} onChange={set("sourceKey")} placeholder="QA-123" hint="Filled automatically from the source step above." />
            <Field label="GitHub token (PAT)" icon={<Github size={12} />} value={v.githubToken} onChange={set("githubToken")} type="password" placeholder="github_pat_…" hint="For the Automation Script agent to read/commit to your repo." />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="GitHub owner" icon={<Github size={12} />} value={v.githubOwner} onChange={set("githubOwner")} placeholder="your-org-or-user" />
            <Field label="GitHub repo" icon={<Github size={12} />} value={v.githubRepo} onChange={set("githubRepo")} placeholder="my-test-automation" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Jira project key" icon={<Bug size={12} />} value={v.jiraProjectKey} onChange={set("jiraProjectKey")} placeholder="QA" hint="Raise defects on failed runs." />
            <Field label="TestRail run ID" icon={<FlaskConical size={12} />} value={v.testrailRunId} onChange={set("testrailRunId")} placeholder="123" hint="Post results to this run." />
            <Field label="Docker image" icon={<Container size={12} />} value={v.dockerImage} onChange={set("dockerImage")} placeholder="mcr.microsoft.com/playwright:latest" hint="Image for local test runs." />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <p className="text-xs text-text-muted mr-auto">
              Skip everything and it still runs end-to-end on local results.
            </p>
            {running ? (
              <Button
                variant="secondary"
                onClick={() => onStop?.()}
                className="!border-red-500/50 !text-red-600 hover:!bg-red-500/10"
              >
                Stop pipeline
              </Button>
            ) : (
              <Button onClick={() => onRun(v)}>Run the 6-agent pipeline</Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
