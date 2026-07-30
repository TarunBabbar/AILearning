"use client";

import { ChatArea } from "@/components/ui/ChatArea";

export default function LearnPage() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-6 py-3 bg-white">
        <h1 className="text-lg font-semibold text-text-primary">AI Learning Tutor</h1>
        <p className="text-sm text-text-muted">
          Ask questions about QA concepts, automation frameworks, testing methodologies, and interview prep.
        </p>
      </div>
      <ChatArea
        namespace="learning"
        placeholder="What would you like to learn about? Try 'Explain the Page Object Model' or 'How do I write parametrized tests in pytest?'"
        showSources={false}
      />
    </div>
  );
}
