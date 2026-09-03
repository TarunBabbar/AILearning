import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared animated loading state for data screens.
 * Shows a pulsing icon with a live status line, then the skeleton grid
 * below — consistent across Dashboard / Matches / Contacts.
 */
export default function LoadingState({
  title = "AI is finding your jobs",
  hint = "Scanning the latest openings",
  icon = Sparkles,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  children?: React.ReactNode;
  className?: string;
}) {
  const Icon = icon;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="fade-up flex items-center gap-3 rounded-xl border border-claude-border bg-white px-4 py-3 shadow-sm">
        {/* Pulsing icon with halo ring */}
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <span className="animate-halo text-claude-accent/40" />
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-claude-accent-soft text-claude-accent">
            <Icon size={16} />
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-claude-text">
            {title}
            <span className="text-claude-accent">
              <span className="animate-dot">.</span>
              <span className="animate-dot">.</span>
              <span className="animate-dot">.</span>
            </span>
          </div>
          <div className="text-[11px] text-claude-muted">{hint}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
