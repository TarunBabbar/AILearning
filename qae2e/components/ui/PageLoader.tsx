// Branded full-page loading state — replaces bare "Loading…" spinners.
import { Sparkles } from "lucide-react";

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500 text-white shadow-lg">
        <Sparkles size={22} />
      </span>
      <p className="text-sm text-text-secondary flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        {label}
      </p>
    </div>
  );
}
