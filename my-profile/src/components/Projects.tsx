"use client";

import { motion } from "framer-motion";

type Project = {
  title: string;
  desc: string;
  tech: string[];
  repo: string;
  demo: string | null;
  badge?: string;
  accent?: "amber" | "emerald";
  emoji: string;
};

// One uniform grid: every project is the same card. The two headline projects
// carry a badge (and a coloured ring) instead of their own oversized blocks, so
// the section keeps a single rhythm and no dead space.
const projects: Project[] = [
  {
    title: "QAE2E — AI-Powered QA Pipeline",
    desc: "An agentic QA pipeline — requirement to release confidence, every step judged by an AI agent team.",
    tech: ["Next.js", "OpenRouter", "Agent Orchestration", "Pinecone", "MCP", "Docker"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qae2e",
    demo: "https://qae2e.vercel.app",
    badge: "🏆 1st Place",
    accent: "amber",
    emoji: "🤖",
  },
  {
    title: "QABuddy — Hybrid RAG QA Assistant",
    desc: "Ask a QA question, get one answer with its sources cited — drawn from your Jira stories, test cases, bugs and the real Playwright UI and API automation code, searched by meaning as well as keyword.",
    tech: ["FastAPI", "Pinecone", "OpenRouter", "RAG", "Vercel"],
    repo: "https://github.com/TarunBabbar/qa-rag",
    demo: "https://qa-rag-five.vercel.app",
    badge: "Flagship",
    accent: "emerald",
    emoji: "💬",
  },
  {
    title: "QA Jobs Portal",
    desc: "Free daily India QA jobs portal — AI-extracted QA listings from multiple sources, curated and refreshed every day for QA engineers.",
    tech: ["Next.js", "PostgreSQL", "Prisma", "OpenRouter", "AI Extraction"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/job-details",
    demo: "https://qajobs.vercel.app",
    emoji: "💼",
  },
  {
    title: "QA AI Dashboard",
    desc: "Unified AI platform — LLM-scored resume-job matcher, QA interview RAG chat, PRD test-case generator, AI tutor and document Q&A.",
    tech: ["Next.js", "PostgreSQL", "Prisma", "Pinecone", "OpenRouter"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qadashboard",
    demo: "https://qadashboard-lime.vercel.app",
    emoji: "📊",
  },
  {
    title: "QA RAG Platform",
    desc: "Upload documents and ask AI questions with grounded citations — smart chunking, configurable embeddings and Pinecone vector search.",
    tech: ["Next.js", "OpenRouter", "Pinecone", "Vector Search"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qaragplatform",
    demo: "https://qaragplatform.vercel.app",
    emoji: "📚",
  },
  {
    title: "QA Interview Prep Kit",
    desc: "RAG-powered interview preparation — PDF/DOCX knowledge base indexed into Pinecone with a streaming QA assistant and grounded citations.",
    tech: ["Next.js", "OpenRouter", "Pinecone", "RAG"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qa-interview-preparation-kit",
    demo: "https://qa-interview-preparation.vercel.app",
    emoji: "🎯",
  },
  {
    title: "Jira QA Crew",
    desc: "QA pipeline driven by a crew of AI agents — connects to Jira stories and walks through analysis, test generation and execution workflows.",
    tech: ["Next.js", "Agent Crew", "TypeScript", "AI Pipeline"],
    repo: "https://github.com/TarunBabbar/jira-qa-crew-next",
    demo: "https://jira-qa-crew-next.vercel.app",
    emoji: "🛰",
  },
  {
    title: "Resume → Job RAG Pipeline",
    desc: "Full-stack RAG pipeline: upload resume → AI profile extraction → multi-source job search → eligibility filter → LLM-ranked matches.",
    tech: ["React", "Express", "ChromaDB", "OpenRouter"],
    repo: "https://github.com/TarunBabbar/resume-job-rag",
    demo: null,
    emoji: "📄",
  },
  {
    title: "Chroma RAG Pipeline Visualizer",
    desc: "RAG visualizer with a live 3-panel UI — ingest PDFs/DOCX, embed via OpenRouter, vector search, and see the LLM answer with real-time progress.",
    tech: ["React", "Express", "ChromaDB", "SSE"],
    repo: "https://github.com/TarunBabbar/chroma-react-rag-pipeline",
    demo: null,
    emoji: "🔍",
  },
  {
    title: "8-Layer Playwright Framework",
    desc: "Enterprise-grade Playwright framework with strict 8-layer architecture — POM, fixtures, API layer, reporting, Docker and CI-ready.",
    tech: ["Playwright", "TypeScript", "Docker", "CI/CD"],
    repo: "https://github.com/TarunBabbar/8layer-advance-playwright-framework",
    demo: null,
    badge: "Framework",
    emoji: "🎭",
  },
  {
    title: "Self-Healing Playwright",
    desc: "AI-powered self-healing test framework that detects broken locators and repairs them automatically when the UI changes.",
    tech: ["Playwright", "GPT-4", "OpenAI", "TypeScript"],
    repo: "https://github.com/TarunBabbar/SelfHealingPlaywrightFramework",
    demo: null,
    badge: "Framework",
    emoji: "🩹",
  },
];

const RING: Record<string, string> = {
  emerald: "border-emerald-500/35 hover:border-emerald-500",
  amber: "border-amber-500/35 hover:border-amber-500",
};

const BADGE: Record<string, string> = {
  emerald: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700",
  amber: "bg-amber-500/10 border-amber-500/25 text-amber-700",
};

export default function Projects() {
  return (
    <section id="apps" className="py-12 sm:py-16 bg-bg-soft">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-5"
        >
          <div>
            <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
              AI Applications
            </div>
            <h2 className="text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold tracking-[-0.02em] mb-2">
              AI Apps You Can Run Today
            </h2>
            <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">
              Live applications I designed and built end-to-end. No code walls
              here — every card opens a working demo, its source on GitHub, or
              both.
            </p>
          </div>
          <a
            href="https://github.com/TarunBabbar"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 text-sm font-semibold text-amber-600 border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 px-4 py-2 rounded-lg transition-all w-fit"
          >
            Explore all repos on GitHub
            <span aria-hidden>→</span>
          </a>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <ProjectCard key={p.title} project={p} i={i} />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          Plus 20+ more repositories — Selenium & Appium suites, API automation,
          C#/.NET frameworks and agent experiments.{" "}
          <a
            href="https://github.com/TarunBabbar"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-600 hover:underline font-medium"
          >
            Explore everything on GitHub →
          </a>
        </p>
      </div>
    </section>
  );
}

function ProjectCard({ project, i }: { project: Project; i: number }) {
  const p = project;
  const ring = RING[p.accent ?? ""] ?? "border-border hover:border-amber-400";
  const badge = BADGE[p.accent ?? ""] ?? "bg-bg-soft border-border text-text-muted";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3) }}
      className={`card-accent group relative flex flex-col rounded-xl border bg-bg-card p-3.5 transition-all hover:bg-bg-card-hover hover:-translate-y-0.5 hover:shadow-md ${ring}`}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="w-9 h-9 rounded-lg bg-bg-soft border border-border flex items-center justify-center text-base shrink-0">
          {p.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-[13.5px] leading-snug text-text">{p.title}</h4>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {p.demo && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            )}
            {p.badge && (
              <span
                className={`text-[9.5px] font-bold uppercase tracking-wider border px-1.5 py-[1px] rounded ${badge}`}
              >
                {p.badge}
              </span>
            )}
          </span>
        </div>
      </div>

      <p className="mb-3 flex-1 text-[12.5px] text-text-secondary leading-relaxed">{p.desc}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {p.tech.map((t) => (
          <span
            key={t}
            className="text-[10px] font-medium bg-bg-soft border border-border text-text-secondary px-1.5 py-[2px] rounded"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex gap-3.5 border-t border-border pt-2.5">
        {/* live apps link to the running demo only; the rest link to source */}
        {p.demo ? (
          <a
            href={p.demo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11.5px] font-semibold text-amber-600 group-hover:text-amber-700 inline-flex items-center gap-1"
          >
            Live Demo
            <span aria-hidden>→</span>
          </a>
        ) : (
          <a
            href={p.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11.5px] font-semibold text-text-secondary group-hover:text-amber-700 inline-flex items-center gap-1"
          >
            GitHub
            <span aria-hidden>→</span>
          </a>
        )}
      </div>
    </motion.div>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
