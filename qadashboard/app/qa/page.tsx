"use client";

import { ChatArea } from "@/components/ui/ChatArea";

export default function QAPage() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-6 py-3 bg-white">
        <h1 className="text-lg font-semibold text-text-primary">QA Interview Assistant</h1>
        <p className="text-sm text-text-muted">
          Ask questions about QA, testing, automation, and more. Powered by 400+ interview Q&A.
        </p>
      </div>
      <ChatArea
        placeholder="Ask a QA interview question..."
        namespace="qa-interview"
        showSources={true}
      />
    </div>
  );
}
