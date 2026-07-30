"use client";

import { useParams } from "next/navigation";
import { ChatArea } from "@/components/ui/ChatArea";

export default function DocumentDetailPage() {
  const params = useParams();
  const docId = params.id as string;

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-6 py-3 bg-white">
        <h1 className="text-lg font-semibold text-text-primary">Document Q&A</h1>
        <p className="text-sm text-text-muted">Ask questions about this document</p>
      </div>
      <ChatArea
        namespace="documents"
        placeholder="Ask a question about this document..."
        showSources={true}
      />
    </div>
  );
}
