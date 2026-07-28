"use client";

import { useState, useEffect } from "react";
import {
  Search,
  FileText,
  Loader2,
  Sparkles,
  FolderTree,
} from "lucide-react";

export default function QuestionsPage() {
  const [mode, setMode] = useState<"file" | "ai">("file");
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelectedTopic(null);
    setQuestions([]);
    fetch(`/api/questions?mode=${mode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.topics) setTopics(data.topics);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mode]);

  async function loadTopic(topic: string) {
    setSelectedTopic(topic);
    setQuestions([]);
    setExpandedIndex(null);
    const res = await fetch(`/api/questions?topic=${encodeURIComponent(topic)}&mode=${mode}`);
    const data = await res.json();
    setQuestions(data.questions || []);
  }

  function switchMode(newMode: "file" | "ai") {
    if (newMode === mode) return;
    setMode(newMode);
  }

  return (
    <div className="flex h-screen">
      {/* Topic sidebar */}
      <div className="w-56 border-r border-claude-border bg-claude-beige-light p-4 overflow-y-auto shrink-0">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-text-light" />
          <input
            placeholder="Search topics..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-claude-border rounded-lg focus:outline-none focus:ring-2 focus:ring-claude-accent/30"
          />
        </div>
        <div className="flex gap-1 mb-4 p-1 bg-claude-beige-dark rounded-lg">
          <button
            onClick={() => switchMode("file")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
              mode === "file"
                ? "bg-white text-claude-text font-medium shadow-sm"
                : "text-claude-text-muted hover:text-claude-text"
            }`}
          >
            <FolderTree size={14} />
            By File
          </button>
          <button
            onClick={() => switchMode("ai")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
              mode === "ai"
                ? "bg-white text-claude-text font-medium shadow-sm"
                : "text-claude-text-muted hover:text-claude-text"
            }`}
          >
            <Sparkles size={14} />
            Refined
          </button>
        </div>
        <h3 className="text-xs font-semibold text-claude-text-muted uppercase tracking-wider mb-3">
          {mode === "ai" ? "Refined Topics" : "Topics by File"}
        </h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-claude-text-light" />
          </div>
        ) : topics.length === 0 ? (
          <p className="text-sm text-claude-text-light">No topics yet. Upload PDFs first.</p>
        ) : (
          <div className="space-y-1">
            {topics.map((topic) => (
              <button
                key={topic}
                onClick={() => loadTopic(topic)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  selectedTopic === topic
                    ? "bg-claude-beige-dark text-claude-text font-medium"
                    : "text-claude-text-muted hover:bg-claude-beige-dark/50"
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-5 border-b border-claude-border bg-claude-beige-light">
          <h2 className="text-lg font-semibold text-claude-text">
            {selectedTopic || "Select a topic"}
          </h2>
          <p className="text-sm text-claude-text-muted">
            {selectedTopic
              ? `${questions.length} questions found`
              : "Choose a topic from the sidebar to view questions"}
          </p>
        </div>

        <div className="p-6 space-y-3">
          {selectedTopic && questions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-claude-text-muted">Loading questions...</p>
            </div>
          )}

          {questions.map((q, i) => (
            <div key={i} className="claude-card overflow-hidden fade-in">
              <button
                onClick={() =>
                  setExpandedIndex(expandedIndex === i ? null : i)
                }
                className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-claude-beige-light transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-claude-text">
                    {q.question}
                  </p>
                </div>
              </button>

              {expandedIndex === i && (
                <div className="px-5 pb-4 pt-0 slide-in-left">
                  <div className="p-4 rounded-xl bg-claude-beige-light border border-claude-border">
                    <p className="text-sm text-claude-text whitespace-pre-wrap leading-relaxed">
                      {q.answer}
                    </p>
                    <div className="mt-3 pt-3 border-t border-claude-border flex items-center gap-2">
                      <FileText size={12} className="text-claude-text-light" />
                      <span className="text-xs text-claude-text-light">{q.source}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {!selectedTopic && (
            <div className="flex items-center justify-center py-24">
              <div className="text-center max-w-sm">
                <FileText size={40} className="mx-auto mb-4 text-claude-text-light" />
                <p className="text-claude-text-muted">
                  Select a topic from the left sidebar to browse questions and answers.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
