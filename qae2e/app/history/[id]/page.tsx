import { Suspense } from "react";
import { RunDetailPageInner } from "./RunDetailClient";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-text-muted">Loading run…</div>}>
      <RunDetailPageInner id={id} />
    </Suspense>
  );
}
