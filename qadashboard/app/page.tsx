"use client";

import Link from "next/link";
import { Briefcase, MessageSquare, FileText, Beaker, GraduationCap, ArrowRight, BookOpen, FileUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import PageChrome from "@/components/ui/PageChrome";
import { StatSkeleton } from "@/components/ui/Skeleton";
import { useListSWR } from "@/lib/use-list-swr";

type Stats = { documents: number; qaPairs: number; jobs: number; topics: number; projects: number };

export default function DashboardPage() {
  const { data: stats, error } = useListSWR<Stats>("/api/stats");
  const values = stats || { documents: 0, qaPairs: 0, jobs: 0, topics: 0, projects: 0 };
  const modules = [
    { title: "Resume & Job Matcher", description: "Upload your resume, extract jobs from PDFs, get AI-scored matches and send applications.", href: "/resume", icon: Briefcase, color: "bg-accent-soft text-accent-strong", stat: `${values.jobs} jobs` },
    { title: "QA Interview Prep", description: "AI-powered Q&A assistant with interview questions, grounded answers, and source citations.", href: "/qa", icon: MessageSquare, color: "bg-[#e6edf5] text-[#4a6d8c]", stat: `${values.qaPairs} Q&A pairs` },
    { title: "Document RAG", description: "Upload PDFs, DOCX, spreadsheets and ask questions grounded in your documents.", href: "/documents", icon: FileText, color: "bg-[#f3e8f5] text-[#7a3d8c]", stat: `${values.documents} documents` },
    { title: "Test Architect", description: "Paste requirements or JIRA keys to generate structured test cases with AI.", href: "/test-architect", icon: Beaker, color: "bg-[#e3efe3] text-[#3d7a3d]", stat: `${values.projects} projects` },
    { title: "AI Learning Tutor", description: "Interactive AI tutor for QA concepts, frameworks, and interview preparation.", href: "/learn", icon: GraduationCap, color: "bg-[#fdf0d5] text-[#9a7b2d]", stat: "Interactive" },
  ];
  const statItems = [{ label: "Documents", value: values.documents, icon: FileUp, color: "bg-[#f3e8f5] text-[#7a3d8c]" }, { label: "Q&A Pairs", value: values.qaPairs, icon: BookOpen, color: "bg-[#e6edf5] text-[#4a6d8c]" }, { label: "Jobs", value: values.jobs, icon: Briefcase, color: "bg-accent-soft text-accent-strong" }, { label: "Topics", value: values.topics, icon: Sparkles, color: "bg-[#e3efe3] text-[#3d7a3d]" }, { label: "Projects", value: values.projects, icon: Beaker, color: "bg-[#fdf0d5] text-[#9a7b2d]" }];

  return <PageChrome maxWidthClass="max-w-6xl" header={<div><h1 className="text-lg font-semibold tracking-tight text-text-primary">QA AI Dashboard</h1><p className="mt-1 text-sm text-text-muted">Your unified workspace for QA learning, job matching, documents, and test design.</p></div>}><div className="space-y-6 pb-8">{!stats && !error ? <StatSkeleton /> : <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{statItems.map(({ label, value, icon: Icon, color }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm"><div className={cn("rounded-lg p-2.5", color)}><Icon size={19} /></div><div><p className="text-xl font-bold tabular-nums text-text-primary">{value}</p><p className="text-xs text-text-muted">{label}</p></div></div>)}</div>}{error && <div className="rounded-lg border border-border bg-white p-3 text-sm text-red-600">Could not load dashboard statistics.</div>}<div><h2 className="mb-3 text-base font-semibold text-text-primary">Workspace modules</h2><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map(({ title, description, href, icon: Icon, color, stat }) => <Link key={href} href={href} className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><div className="p-5"><div className="flex items-start justify-between"><span className={cn("rounded-lg p-2.5", color)}><Icon size={21} /></span><span className="rounded-md bg-bg-surface px-2 py-1 text-xs text-text-muted">{stat}</span></div><h3 className="mt-4 font-semibold text-text-primary">{title}</h3><p className="mt-1 text-sm leading-relaxed text-text-secondary">{description}</p><div className="mt-4 flex items-center gap-1 text-sm font-medium text-amber-700 opacity-0 transition-opacity group-hover:opacity-100">Open <ArrowRight size={14} /></div></div></Link>)}</div></div></div></PageChrome>;
}
