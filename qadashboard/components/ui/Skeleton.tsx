import { cn } from "@/lib/utils";

/** Base shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-bg-surface", className)} />;
}

/** Skeleton grid of job cards (Matches / dashboard modules). */
export function JobCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-white p-3.5 shadow-sm">
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

/** Skeleton group rows (Companies / Browse). */
export function GroupListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-lg border border-border bg-white px-3.5 py-2.5 shadow-sm"
        >
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <Skeleton className="h-3.5 max-w-[12rem] flex-1" />
          <Skeleton className="h-4 w-6 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton table rows (Companies). */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-border bg-bg-surface/40 px-3.5 py-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0"
        >
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-44" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton stat blocks (Dashboard). */
export function StatSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-white p-4"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="mt-1.5 h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-shell loading placeholder (auth gate): sidebar + page skeleton. */
export function ShellSkeleton() {
  return (
    <div className="flex h-full w-full bg-bg-page">
      <div className="w-56 shrink-0 border-r border-border bg-bg-sidebar p-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="mt-6 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-5/6" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
      <div className="min-w-0 flex-1 p-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-6">
          <StatSkeleton />
        </div>
      </div>
    </div>
  );
}
