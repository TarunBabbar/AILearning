import { Suspense } from "react";
import { WorkspacePageInner } from "./WorkspaceClient";

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-text-muted">Loading workspace…</div>}>
      <WorkspacePageInner />
    </Suspense>
  );
}
