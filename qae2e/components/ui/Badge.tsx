import { cn } from "@/lib/utils";

type Tone = "default" | "amber" | "green" | "red" | "blue";

const tones: Record<Tone, string> = {
  default: "bg-bg-hover text-text-secondary",
  amber: "bg-amber-500/10 text-amber-700",
  green: "bg-emerald-500/10 text-emerald-700",
  red: "bg-red-500/10 text-red-700",
  blue: "bg-sky-500/10 text-sky-700",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
