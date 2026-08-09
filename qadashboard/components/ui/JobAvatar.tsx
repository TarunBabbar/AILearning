import { cn } from "@/lib/utils";

// Deterministic pastel avatar colors derived from a seed string (company name).
const AVATAR_COLORS = [
  "bg-accent-soft text-accent-strong",
  "bg-[#e6edf5] text-[#4a6d8c]",
  "bg-[#e3efe3] text-[#3d7a3d]",
  "bg-[#f3e8f5] text-[#7a3d8c]",
  "bg-[#e8f0d9] text-[#5a7a2d]",
  "bg-[#fdf0d5] text-[#9a7b2d]",
];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Deterministic pastel avatar tile (initials) derived from a company name.
 * `withBar` renders a 2px color bar above, for card top edges.
 */
export function JobAvatar({
  name,
  size = "md",
  withBar = false,
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  withBar?: boolean;
  className?: string;
}) {
  const color = avatarColor(name || "?");
  const box =
    size === "lg"
      ? "h-14 w-14 rounded-2xl text-lg"
      : size === "sm"
        ? "h-7 w-7 rounded-lg text-[10px]"
        : "h-8 w-8 rounded-lg text-[11px]";

  const tile = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold",
        box,
        color
      )}
    >
      {initials(name || "?")}
    </span>
  );

  if (!withBar) return tile;

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("h-0.5 w-full rounded-t-lg", color.split(" ")[0])} />
      {tile}
    </div>
  );
}
