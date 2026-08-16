"use client";

// Integrations panel. MCP connectors are placeholders (copy-paste workflow),
// and the real DeepEval framework integration is tracked as work-in-progress —
// stage evaluation currently runs on an in-app LLM judge (EVAL_MODEL).

import { CONNECTORS } from "@/lib/connectors";
import { Card } from "@/components/ui/Card";
import { PlugZap, Clock, Info, FlaskConical, ExternalLink } from "lucide-react";

export function IntegrationsTab({ workspaceId: _workspaceId }: { workspaceId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-500/10">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-text-primary">
          Currently supporting <span className="font-bold text-amber-700">copy-pasted requirements</span> only.
          MCP server connections to Jira, Confluence, GitHub, Zephyr, TestRail, and Pinecone are coming soon —
          nothing needs to be configured here yet.
        </p>
      </div>

      {/* Real DeepEval framework — work in progress */}
      <Card className="p-4 border-dashed">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-amber-600 shrink-0" />
          <h4 className="text-sm font-semibold text-text-primary">DeepEval framework integration</h4>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            <Clock size={9} /> work in progress
          </span>
        </div>
        <p className="mt-2 text-xs text-text-muted leading-relaxed">
          Stage evaluation currently uses an in-app AI judge (free LLM via OpenRouter) to score precision, accuracy
          and completeness per pipeline stage. The official DeepEval framework (G-Eval, Faithfulness, Answer
          Relevancy, Hallucination metrics) requires a Python runtime — planned as a separate evaluation service.
          <a
            href="https://docs.confident-ai.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-amber-700 hover:underline ml-1"
          >
            Learn more <ExternalLink size={10} />
          </a>
        </p>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CONNECTORS.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-center gap-2">
              <PlugZap size={14} className="text-amber-600 shrink-0" />
              <h4 className="text-sm font-semibold text-text-primary">{c.name}</h4>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                <Clock size={9} /> coming soon
              </span>
            </div>
            <p className="mt-2 text-xs text-text-muted leading-relaxed">{c.docsUrl || "MCP connection not available yet."}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
