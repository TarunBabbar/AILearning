import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface Step {
  key: string;
  num: string;
  label: string;
  sub: string;
}

export const PIPELINE_STEPS: Step[] = [
  { key: "connect", num: "01", label: "Connect", sub: "Capture requirement" },
  { key: "analyze", num: "02", label: "Analyze", sub: "Requirement intelligence" },
  { key: "coverage", num: "03", label: "Coverage", sub: "Editable test cases" },
  { key: "automate", num: "04", label: "Automate", sub: "Framework scripts" },
  { key: "execute", num: "05", label: "Execute", sub: "Cycle + evidence" },
  { key: "release", num: "06", label: "Release", sub: "Confidence gauge" },
];

export function Stepper({
  current,
  done,
}: {
  current: number;
  done: Set<string>;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {PIPELINE_STEPS.map((step, i) => {
        const isDone = done.has(step.key);
        const isActive = i === current;
        return (
          <div key={step.key} className="flex items-center flex-1 min-w-[110px]">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold transition-all",
                  isDone
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700"
                    : isActive
                      ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                      : "bg-bg-surface border-border text-text-muted"
                )}
              >
                {isDone ? <Check size={14} /> : step.num}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold whitespace-nowrap",
                  isActive ? "text-amber-700" : isDone ? "text-text-secondary" : "text-text-muted"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <div className={cn("flex-1 h-px mx-2 mb-5", i < current ? "bg-amber-500/50" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
