import { cn } from "@/lib/utils";

/** Base shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-claude-bg",
        className
      )}
    />
  );
}

/** Skeleton grid of job cards (QA Jobs page). */
export function JobCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-claude-border bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="mt-1.5 h-2.5 w-1/2" />
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-4 w-20 rounded" />
      </div>
      <Skeleton className="mt-2 h-2.5 w-full" />
      <Skeleton className="mt-1 h-2.5 w-5/6" />
      <div className="mt-auto flex items-center justify-between pt-2.5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-14" />
      </div>
    </div>
  );
}

/** Skeleton grid of job cards (QA Jobs / Match pages). */
export function JobGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton table rows (Contacts page). */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-claude-border bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-claude-border bg-claude-bg/40 px-3.5 py-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-claude-border px-3.5 py-2.5 last:border-b-0"
        >
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-44" />
        </div>
      ))}
    </div>
  );
}
