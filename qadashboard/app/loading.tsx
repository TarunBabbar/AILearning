import { StatSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
      <div className="shrink-0 border-b border-border bg-bg-page px-5 pb-2.5 pt-3">
        <div className="h-6 w-48 animate-pulse rounded bg-bg-surface" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-bg-surface" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-3">
        <StatSkeleton />
      </div>
    </div>
  );
}
