"use client";

// MCP connections status card — shows every connector registry entry as a
// "coming soon" placeholder tile. No API calls, no credentials: the current
// workflow supports copy-pasted requirements only.

import { CONNECTORS } from "@/lib/connectors";
import { Card } from "@/components/ui/Card";
import { PlugZap, Clock } from "lucide-react";

export function McpConnectionsCard() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <PlugZap size={15} className="text-amber-600" />
        <h3 className="text-sm font-semibold text-text-primary">MCP connections</h3>
      </div>
      <p className="text-xs text-text-muted mb-3">
        Coming soon — the current workflow supports copy-pasted requirements only.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CONNECTORS.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-bg-page px-2.5 py-2"
            title={c.docsUrl}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400/60 shrink-0" />
            <span className="text-xs text-text-secondary truncate">{c.name}</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-text-muted shrink-0">
              <Clock size={9} /> soon
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
