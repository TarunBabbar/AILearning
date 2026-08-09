import { cn } from "@/lib/utils";

/** "Showing 1–40 of 328" range label for paginated lists. */
export default function ShowingRange({
  page,
  pageSize,
  itemCount,
  total,
  className,
}: {
  page: number;
  pageSize: number;
  itemCount: number;
  total: number;
  className?: string;
}) {
  if (total <= 0 || itemCount <= 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = (page - 1) * pageSize + itemCount;

  return (
    <span className={cn("text-[11px] text-claude-muted", className)}>
      Showing{" "}
      <span className="font-medium text-claude-text">
        {start.toLocaleString()}–{end.toLocaleString()}
      </span>{" "}
      of{" "}
      <span className="font-medium text-claude-text">
        {total.toLocaleString()}
      </span>
    </span>
  );
}
