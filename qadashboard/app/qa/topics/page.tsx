"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BookOpen, ChevronDown, Sparkles, FileText } from "lucide-react";

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
  const [topics, setTopics] = useState<Topic[]>([]);
  const [mode, setMode] = useState<"file" | "ai">("file");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/topics?mode=${mode}`)
      .then((r) => r.json())
      .then((data) => {
        setTopics(data.topics || []);
        if (data.topics?.length > 0) setSelectedTopic(data.topics[0].name);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mode]);

  const currentTopic = topics.find((t) => t.name === selectedTopic);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-6 py-3 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Q&A Topics</h1>
          <p className="text-sm text-text-muted">Browse interview questions by topic</p>
        </div>
        <div className="flex items-center gap-1 bg-bg-surface rounded-lg border border-border p-0.5">
          <button
            onClick={() => setMode("file")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
              mode === "file"
                ? "bg-white text-text-primary shadow-sm font-medium"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            <FileText size={14} />
            By File
          </button>
          <button
            onClick={() => setMode("ai")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
              mode === "ai"
                ? "bg-white text-text-primary shadow-sm font-medium"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            <Sparkles size={14} />
            AI Refined
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
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
              {currentTopic.questions.map((q) => (
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {q.question}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">{q.source}</p>
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
