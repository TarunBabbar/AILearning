"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Briefcase,
  MessageSquare,
  FileText,
  Beaker,
  GraduationCap,
  ArrowRight,
  BookOpen,
  FileUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Stats = {
  documents: number;
  qaPairs: number;
  jobs: number;
  topics: number;
  projects: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    documents: 0,
    qaPairs: 0,
    jobs: 0,
    topics: 0,
    projects: 0,
  });

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const modules = [
    {
      title: "Resume & Job Matcher",
      description: "Upload your resume, extract jobs from PDFs, get AI-scored matches and send applications.",
      href: "/resume",
      icon: Briefcase,
      color: "bg-amber-500/10 text-amber-600",
      stat: `${stats.jobs} jobs`,
    },
    {
      title: "QA Interview Prep",
      description: "AI-powered Q&A assistant with 400+ interview questions. Chat, browse topics, upload more docs.",
      href: "/qa",
      icon: MessageSquare,
      color: "bg-blue-500/10 text-blue-600",
      stat: `${stats.qaPairs} Q&A pairs`,
    },
    {
      title: "Document RAG",
      description: "Upload PDFs, DOCX, spreadsheets and ask questions. AI answers grounded in your documents.",
      href: "/documents",
      icon: FileText,
      color: "bg-purple-500/10 text-purple-600",
      stat: `${stats.documents} documents`,
    },
    {
      title: "Test Architect",
      description: "Paste PRD requirements or JIRA keys to generate structured test cases with AI.",
      href: "/test-architect",
      icon: Beaker,
      color: "bg-green-500/10 text-green-600",
      stat: `${stats.projects} projects`,
    },
    {
      title: "AI Learning Tutor",
      description: "Interactive AI tutor for QA concepts, automation frameworks, and interview prep.",
      href: "/learn",
      icon: GraduationCap,
      color: "bg-rose-500/10 text-rose-600",
      stat: "Interactive",
    },
  ];

  return (
    <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">QA AI Dashboard</h1>
        <p className="text-text-secondary mt-1">
          Your unified QA platform — resume matching, interview prep, document analysis, and test generation.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Documents", value: stats.documents, icon: FileUp, color: "bg-purple-500/10 text-purple-600" },
          { label: "Q&A Pairs", value: stats.qaPairs, icon: BookOpen, color: "bg-blue-500/10 text-blue-600" },
          { label: "Jobs", value: stats.jobs, icon: Briefcase, color: "bg-amber-500/10 text-amber-600" },
          { label: "Topics", value: stats.topics, icon: Sparkles, color: "bg-green-500/10 text-green-600" },
          { label: "Projects", value: stats.projects, icon: Beaker, color: "bg-rose-500/10 text-rose-600" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-bg-surface rounded-lg border border-border p-4 flex items-center gap-3"
            >
              <div className={cn("p-2 rounded-lg", s.color)}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{s.value}</p>
                <p className="text-xs text-text-muted">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Cards */}
      <h2 className="text-lg font-semibold text-text-primary mb-4">Modules</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="group bg-white rounded-lg border border-border p-5 hover:border-amber-500/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("p-2.5 rounded-lg", mod.color)}>
                  <Icon size={22} />
                </div>
                <span className="text-xs text-text-muted bg-bg-surface px-2 py-0.5 rounded-full">
                  {mod.stat}
                </span>
              </div>
              <h3 className="font-semibold text-text-primary mb-1 group-hover:text-amber-700 transition-colors">
                {mod.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">{mod.description}</p>
              <div className="flex items-center gap-1 mt-3 text-sm text-amber-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight size={14} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
