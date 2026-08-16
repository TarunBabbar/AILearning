import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm border border-transparent",
  secondary:
    "bg-transparent text-text-primary border border-border hover:border-amber-500/50 hover:bg-bg-hover active:bg-bg-surface",
  ghost: "bg-transparent text-amber-700 hover:bg-amber-500/10 active:bg-amber-500/15 border border-transparent",
};

export function Button({
  children,
  href,
  variant = "primary",
  className,
  ...props
}: {
  children: ReactNode;
  href?: string;
  variant?: Variant;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-lg font-semibold text-sm transition-all cursor-pointer select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-page",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
    styles[variant],
    className
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
