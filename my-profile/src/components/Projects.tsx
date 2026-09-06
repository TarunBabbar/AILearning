"use client";

import { motion } from "framer-motion";

type Project = {
  title: string;
  desc: string;
  tech: string[];
  repo: string;
  demo: string | null;
  tag?: string;
  emoji: string;
};

const featured: Project = {
  title: "QAE2E — AI-Powered QA Pipeline",
  desc: "An agentic QA pipeline — requirement to release confidence, every step judged by an AI agent team.",
  tech: ["Next.js", "OpenRouter", "Agent Orchestration", "Pinecone", "MCP", "Docker"],
  repo: "https://github.com/TarunBabbar/AILearning/tree/main/qae2e",
  demo: "https://qae2e.vercel.app",
  tag: "1st Place · AI Tester Blueprint 3x",
  emoji: "🤖",
};

const apps: Project[] = [
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
    tag: "Framework",
    emoji: "🎭",
  },
  {
    title: "Self-Healing Playwright",
    desc: "AI-powered self-healing test framework that detects broken locators and repairs them automatically when the UI changes.",
    tech: ["Playwright", "GPT-4", "OpenAI", "TypeScript"],
    repo: "https://github.com/TarunBabbar/SelfHealingPlaywrightFramework",
    demo: null,
    tag: "Framework",
    emoji: "🩹",
  },
];

export default function Projects() {
  return (
    <section id="apps" className="py-20 sm:py-24 bg-bg-soft">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
        >
          <div>
            <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
              AI Applications
            </div>
            <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em] mb-3">
              AI Apps You Can Run Today
            </h2>
            <p className="text-text-secondary max-w-2xl leading-relaxed">
              Live applications I designed and built end-to-end. No code walls
              here — every card opens a working demo, its source on GitHub, or
              both. Explore what 18 years of QA thinking plus agentic AI can
              ship.
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

        {/* 🏆 Featured — QAE2E, 1st place */}
        <motion.article
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative mb-12 rounded-2xl border border-amber-500/25 bg-bg-card p-6 sm:p-8 overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500 text-white text-xs font-bold uppercase tracking-wide px-3.5 py-1.5 mb-4">
                🏆 1st Place — AI Tester Blueprint 3x
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold tracking-[-0.02em] mb-3">
                {featured.emoji} {featured.title}
              </h3>
              <p className="text-text-secondary leading-relaxed mb-4 max-w-3xl">
                {featured.desc}
              </p>

              {/* Pipeline */}
              <div className="flex flex-wrap items-center gap-2 mb-5 text-xs">
                {["Requirement", "Test Cases", "Playwright Code", "Execution", "Release Confidence"].map(
                  (step, i) => (
                    <span key={step} className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-700 font-medium">
                        {step}
                      </span>
                      {i < 4 && <span className="text-amber-500">→</span>}
                    </span>
                  )
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-6">
                {featured.tech.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] font-medium bg-bg-soft border border-border text-text-secondary px-2 py-0.5 rounded"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={featured.demo!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-all shadow-sm"
                >
                  Live Demo
                </a>
                <a
                  href={featured.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-bg-card border border-border-strong hover:border-amber-500 text-text font-semibold text-sm px-5 py-2.5 rounded-lg transition-all"
                >
                  <GitHubIcon className="w-4 h-4" />
                  Source on GitHub
                </a>
              </div>
            </div>
          </div>
        </motion.article>

        {/* Grid of apps */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.map((p, i) => (
            <ProjectCard key={p.title} project={p} i={i} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-text-muted">
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: i * 0.05 }}
      className="card-accent relative flex flex-col bg-bg-card border border-border rounded-xl p-5 transition-all group hover:border-amber-400 hover:bg-bg-card-hover hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-lg shrink-0">
          {p.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-[15px] leading-snug text-text">{p.title}</h4>
          <span className="inline-flex mt-1.5 items-center gap-1.5">
            {p.demo && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            )}
            {p.tag && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                {p.tag}
              </span>
            )}
          </span>
        </div>
      </div>

      <p className="text-[13px] text-text-secondary leading-relaxed mb-4 flex-1">{p.desc}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {p.tech.map((t) => (
          <span
            key={t}
            className="text-[11px] font-medium bg-bg-soft border border-border text-text-secondary px-2 py-0.5 rounded"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex gap-4 border-t border-border pt-3">
        {p.demo && (
          <a
            href={p.demo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-amber-600 group-hover:text-amber-700 inline-flex items-center gap-1"
          >
            Live Demo
            <span aria-hidden>→</span>
          </a>
        )}
        <a
          href={p.repo}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-text-secondary group-hover:text-amber-700 inline-flex items-center gap-1"
        >
          GitHub
          <span aria-hidden>→</span>
        </a>
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
