import { cn } from "@/lib/utils";

type Variant = "solid" | "soft" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  solid:
    "bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 shadow-sm",
  soft: "bg-amber-50 text-amber-700 hover:bg-amber-100",
  ghost:
    "border border-border bg-white text-text-primary hover:bg-bg-surface",
  danger: "text-red-500 hover:bg-red-50",
};

const SIZES: Record<Size, string> = {
  sm: "px-2 py-1 text-[11px] gap-1 rounded-md",
  md: "px-4 py-2 text-sm gap-1.5 rounded-lg",
};

export default function Button({
  variant = "solid",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  );
}
