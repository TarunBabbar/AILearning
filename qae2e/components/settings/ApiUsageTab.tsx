"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Gauge, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface UsageInfo {
  llmModel: string;
  visionModel: string;
  keyConfigured: boolean;
  rateLimit?: { limit?: string; remaining?: string; reset?: string } | null;
  rateLimitError?: string | null;
}

export function ApiUsageTab() {
  const [data, setData] = useState<UsageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/api-usage");
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed");
        setData(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted py-10">
        <Loader2 size={15} className="animate-spin" /> Loading API usage…
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={15} className="text-amber-600" />
          <h3 className="font-semibold text-text-primary">AI models in use</h3>
        </div>
        <div className="space-y-2 text-sm text-text-secondary">
          <p>
            <span className="font-semibold text-text-primary">LLM (agents):</span>{" "}
            <code className="text-xs bg-bg-code text-amber-300 px-1.5 py-0.5 rounded">{data.llmModel}</code>
          </p>
          <p>
            <span className="font-semibold text-text-primary">Vision (image → text):</span>{" "}
            <code className="text-xs bg-bg-code text-amber-300 px-1.5 py-0.5 rounded">{data.visionModel}</code>
          </p>
          <p className="text-xs text-text-muted">
            Free models only — paid models are refused by the runner (assertFreeModel). Configure in .env via
            LLM_MODEL / VISION_MODEL.
          </p>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={15} className="text-amber-600" />
          <h3 className="font-semibold text-text-primary">OpenRouter key</h3>
        </div>
        {!data.keyConfigured ? (
          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-red-600" />
            <span className="text-sm text-text-secondary">No OpenRouter API key configured — agents won't run.</span>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-text-secondary">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>API key configured.</span>
            </div>
            {data.rateLimit ? (
              <p className="text-xs">
                <Badge tone="blue">Limit: {data.rateLimit.limit || "n/a"}</Badge>{" "}
                <Badge tone="blue">Remaining: {data.rateLimit.remaining ?? "n/a"}</Badge>
              </p>
            ) : (
              <p className="text-xs text-text-muted">
                {data.rateLimitError ? `Rate-limit check failed: ${data.rateLimitError}` : "Rate-limit status unavailable."}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
