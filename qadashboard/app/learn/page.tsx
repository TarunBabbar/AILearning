"use client";

import { ChatArea } from "@/components/ui/ChatArea";
import PageChrome from "@/components/ui/PageChrome";

export default function LearnPage() {
  return <PageChrome maxWidthClass="max-w-7xl" header={<div><h1 className="text-lg font-semibold tracking-tight text-text-primary">AI Learning Tutor</h1><p className="mt-1 text-sm text-text-muted">Ask questions about QA concepts, automation frameworks, testing methodologies, and interview prep.</p></div>}><div className="h-full overflow-hidden rounded-xl border border-border bg-white shadow-sm"><ChatArea namespace="learning" placeholder="What would you like to learn about? Try 'Explain the Page Object Model' or 'How do I write parametrized tests in pytest?'" showSources={false} /></div></PageChrome>;
}
