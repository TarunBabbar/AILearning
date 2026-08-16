// Global footer — consistent across pages, with developer credit.
import Link from "next/link";
import { Sparkles } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-text-muted">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 text-white">
            <Sparkles size={13} />
          </span>
          <p>QAE2E — Agentic Quality Engineering.</p>
        </div>
        <p>From Requirement to Release Confidence.</p>
        <p className="text-xs">
          Developed by{" "}
          <span className="font-semibold text-text-secondary">Tarun Kumar Babbar</span>
        </p>
      </div>
    </footer>
  );
}
