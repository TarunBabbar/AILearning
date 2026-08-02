import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary:
    "bg-amber-500 text-white hover:bg-amber-600 shadow-sm border border-transparent",
  secondary:
    "bg-transparent text-text-primary border border-border hover:border-amber-500/40 hover:bg-bg-hover",
  ghost: "bg-transparent text-amber-700 hover:bg-bg-hover border border-transparent",
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
    "inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-lg font-semibold text-sm transition-all cursor-pointer",
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
