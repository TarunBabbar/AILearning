"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Sparkles, ChevronRight, Loader2 } from "lucide-react";

interface Stats {
  documents: string[];
  documentCount: number;
  chunks: number;
  topics: string[];
  topicCount: number;
}

function formatDocName(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/STS Learning_/g, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStats(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-claude-text tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-claude-text-muted mt-1">
          Overview of your QA interview knowledge base
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-claude-text-muted py-12">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading stats...</span>
        </div>
      ) : error ? (
        <div className="claude-card p-6 text-red-500 text-sm">{error}</div>
      ) : stats ? (
        <div className="space-y-8">
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="claude-card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <FileText size={22} className="text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-claude-text">{stats.documentCount}</p>
                <p className="text-xs text-claude-text-muted">Documents</p>
              </div>
            </div>
            <div className="claude-card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <BookOpen size={22} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-claude-text">{stats.chunks}</p>
                <p className="text-xs text-claude-text-muted">Q&A Pairs</p>
              </div>
            </div>
            <div className="claude-card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Sparkles size={22} className="text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-claude-text">{stats.topicCount}</p>
                <p className="text-xs text-claude-text-muted">Topics</p>
              </div>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Indexed documents */}
            {stats.documents.length > 0 && (
              <div className="claude-card">
                <div className="px-5 py-4 border-b border-claude-border">
                  <h3 className="text-sm font-semibold text-claude-text">Indexed Documents</h3>
                </div>
                <div className="p-2 divide-y divide-claude-border/50">
                  {stats.documents.map((doc) => (
                    <div
                      key={doc}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-claude-beige-light transition-colors"
                    >
                      <FileText size={15} className="text-claude-text-light shrink-0" />
                      <span className="text-sm text-claude-text truncate">
                        {formatDocName(doc)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Topics */}
            {stats.topics.length > 0 && (
              <div className="claude-card">
                <div className="px-5 py-4 border-b border-claude-border">
                  <h3 className="text-sm font-semibold text-claude-text">Topics</h3>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {stats.topics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => router.push(`/questions?topic=${encodeURIComponent(topic)}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-claude-beige-dark text-sm text-claude-text hover:bg-claude-accent/10 hover:text-claude-accent transition-colors"
                      >
                        {topic}
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/questions")}
              className="claude-btn-secondary text-sm"
            >
              Browse All Questions
            </button>
            <button
              onClick={() => router.push("/qa-assistant")}
              className="claude-btn-primary text-sm"
            >
              Ask a Question
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
