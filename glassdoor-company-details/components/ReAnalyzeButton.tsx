"use client";

import { useState } from "react";

export default function ReAnalyzeButton({ slug }: { slug: string }) {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function run() {
    setStatus("running");
    setMessage("Re-analyzing with LLM…");
    try {
      const res = await fetch(`/api/analyze?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setStatus("done");
      setMessage("Analysis updated. Refresh to see the newest insights.");
      // hard refresh so server reads the freshly-written JSON
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={run}
        disabled={status === "running"}
        className="inline-flex items-center gap-2 rounded-lg border border-taupe/60 bg-gold/20 px-4 py-2 text-sm font-semibold text-coffee transition hover:bg-gold/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "running" ? "Analyzing…" : "↻ Re-analyze with LLM"}
      </button>
      {message && (
        <span
          className={`text-sm ${
            status === "error" ? "text-rose-700" : "text-mocha"
          }`}
        >
          {message}
        </span>
      )}
    </div>
  );
}