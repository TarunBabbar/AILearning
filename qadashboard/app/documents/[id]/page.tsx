"use client";

import { useParams } from "next/navigation";
import { ChatArea } from "@/components/ui/ChatArea";
import PageChrome from "@/components/ui/PageChrome";

export default function DocumentDetailPage() {
  const params = useParams();
  const docId = params.id as string;

  return <PageChrome maxWidthClass="max-w-7xl" header={<div><h1 className="text-lg font-semibold tracking-tight text-text-primary">Document Q&A</h1><p className="mt-1 text-sm text-text-muted">Ask questions about this document — answers cite its sections.</p></div>}><div className="h-full overflow-hidden rounded-xl border border-border bg-white shadow-sm"><ChatArea namespace={docId} placeholder="Ask a question about this document..." showSources={true} /></div></PageChrome>;
}
