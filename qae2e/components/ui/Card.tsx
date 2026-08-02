import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-surface card-shadow",
        hover &&
          "transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/40 hover:card-shadow-lg",
        className
      )}
    >
      {children}
    </div>
  );
}
