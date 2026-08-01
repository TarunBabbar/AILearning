"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, MessageSquare, Brain, Database, Sparkles, ArrowRight, ExternalLink } from "lucide-react";

type Question = {
  id: string;
  question: string;
  answer: string;
  source: string;
};

type Topic = {
  name: string;
  count: number;
  questions: Question[];
};

export default function QATopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/topics`)
      .then((r) => r.json())
      .then((data) => {
        setTopics(data.topics || []);
        if (data.topics?.length > 0) setSelectedTopic(data.topics[0].name);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentTopic = topics.find((t) => t.name === selectedTopic);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="sticky top-0 z-10 border-b border-border px-6 py-3 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Q&A Topics</h1>
          <p className="text-sm text-text-muted">Browse interview questions by topic</p>
        </div>
        <button
          onClick={() => router.push("/qa")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
        >
          <MessageSquare size={14} />
          QA Assistant Chat
          <ExternalLink size={12} />
        </button>
      </div>

      {/* RAG Flow Info Bar */}
      <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 flex items-center gap-4 text-xs text-blue-800 flex-wrap">
        <span className="font-semibold flex items-center gap-1"><Database size={13} /> Interview Docs</span>
        <ArrowRight size={12} className="text-blue-400" />
        <span className="flex items-center gap-1"><Brain size={13} /> Embeddings</span>
        <ArrowRight size={12} className="text-blue-400" />
        <span className="flex items-center gap-1"><Sparkles size={13} /> Vector Search (Pinecone)</span>
        <ArrowRight size={12} className="text-blue-400" />
        <span className="flex items-center gap-1"><MessageSquare size={13} /> LLM Answer</span>
        <span className="ml-auto text-blue-600/70">Click any question to ask AI →</span>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Topic sidebar */}
        <div className="w-56 border-r border-border overflow-y-auto bg-bg-surface p-2 flex-shrink-0">
          {loading ? (
            <div className="text-sm text-text-muted p-2">Loading topics...</div>
          ) : (
            topics.map((topic) => (
              <button
                key={topic.name}
                onClick={() => setSelectedTopic(topic.name)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5",
                  selectedTopic === topic.name
                    ? "bg-white text-text-primary shadow-sm font-medium border border-border"
                    : "text-text-secondary hover:bg-bg-hover"
                )}
              >
                <span className="truncate block">{topic.name}</span>
                <span className="text-xs text-text-muted">{topic.count} questions</span>
              </button>
            ))
          )}
        </div>

        {/* Q&A content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!currentTopic ? (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              Select a topic to view questions
            </div>
          ) : (
            <div className="space-y-2">
              {currentTopic.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white border border-border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedQ(expandedQ === q.id ? null : q.id)
                    }
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-bg-surface transition-colors"
                  >
                    <div className="flex-1 min-w-0 flex items-start gap-3">
                      <span className="text-xs font-mono text-text-muted mt-0.5 min-w-[24px]">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-text-primary truncate">
                          {q.question}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">{q.source}</p>
                      </div>
                    </div>
                    <ChevronDown
                      size={16}
                      className={cn(
                        "text-text-muted flex-shrink-0 transition-transform ml-2",
                        expandedQ === q.id && "rotate-180"
                      )}
                    />
                  </button>
                  {expandedQ === q.id && (
                    <div className="px-4 pb-3 pt-0 border-t border-border">
                      <div className="markdown-body text-sm text-text-secondary mt-2 whitespace-pre-wrap">
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
  );
}
