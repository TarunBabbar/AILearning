"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  MessageSquare,
  Brain,
  Database,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import PageChrome from "@/components/ui/PageChrome";

type Question = {
  id: string;
  question: string;
  answer: string;
  source: string;
};

type TopicSummary = { name: string; count: number };

export default function QATopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTopic, setLoadingTopic] = useState(false);

  useEffect(() => {
    setLoadingList(true);
    fetch("/api/topics")
      .then((r) => r.json())
      .then((data) => {
        const list: TopicSummary[] = data.topics || [];
        setTopics(list);
        if (list.length > 0) setSelectedTopic(list[0].name);
      })
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    if (!selectedTopic) {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    setLoadingTopic(true);
    setExpandedQ(null);
    fetch(`/api/topics?topic=${encodeURIComponent(selectedTopic)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setQuestions(data.topic?.questions || []);
      })
      .catch(() => {
        if (!cancelled) setQuestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTopic(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTopic]);

  return (
    <PageChrome maxWidthClass="max-w-7xl" header={<div className="flex items-center justify-between"><div><h1 className="text-lg font-semibold tracking-tight text-text-primary">Q&A Topics</h1><p className="mt-1 text-sm text-text-muted">Browse interview questions by topic.</p></div><button onClick={() => router.push("/qa")} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"><MessageSquare size={14} />QA Assistant Chat <ExternalLink size={12} /></button></div>}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-bg-page/60 px-4 py-2 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1 font-medium text-text-secondary"><Database size={13} className="text-amber-500" />Interview docs</span>
          <ArrowRight size={12} />
          <span className="inline-flex items-center gap-1"><Brain size={13} className="text-amber-500" />Embeddings</span>
          <ArrowRight size={12} />
          <span className="inline-flex items-center gap-1"><Sparkles size={13} className="text-amber-500" />Knowledge search</span>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="w-56 shrink-0 overflow-y-auto border-r border-border bg-bg-page/40 p-2">
            {loadingList ? (
              <div className="space-y-1.5 p-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-md bg-bg-surface px-3 py-2">
                    <div className="h-3 w-4/5 rounded bg-bg-hover" />
                    <div className="mt-1.5 h-2.5 w-1/3 rounded bg-bg-hover" />
                  </div>
                ))}
              </div>
            ) : (
              topics.map((topic) => (
                <button
                  key={topic.name}
                  onClick={() => setSelectedTopic(topic.name)}
                  className={cn(
                    "mb-0.5 w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    selectedTopic === topic.name
                      ? "border border-border bg-white font-medium text-text-primary shadow-sm"
                      : "text-text-secondary hover:bg-white/60"
                  )}
                >
                  <span className="block truncate">{topic.name}</span>
                  <span className="text-xs text-text-muted">{topic.count} questions</span>
                </button>
              ))
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loadingTopic ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-lg border border-border bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-6 rounded bg-bg-hover" />
                      <div className="h-3.5 w-2/3 rounded bg-bg-hover" />
                    </div>
                    <div className="mt-2 h-2.5 w-1/3 rounded bg-bg-hover" />
                  </div>
                ))}
              </div>
            ) : !selectedTopic ? (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                Select a topic to view questions
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <div key={q.id} className="overflow-hidden rounded-lg border border-border bg-white">
                    <button
                      onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-bg-page transition-colors"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="mt-0.5 min-w-[24px] font-mono text-xs text-text-muted">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="truncate text-sm font-medium text-text-primary">
                            {q.question}
                          </p>
                          <p className="mt-0.5 text-xs text-text-muted">{q.source}</p>
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        className={cn(
                          "ml-2 shrink-0 text-text-muted transition-transform",
                          expandedQ === q.id && "rotate-180"
                        )}
                      />
                    </button>
                    {expandedQ === q.id && (
                      <div className="border-t border-border px-4 pb-3 pt-0">
                        <div className="markdown-body mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                          {q.answer}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageChrome>
  );
}
