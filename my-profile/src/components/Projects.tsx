"use client";

import { motion } from "framer-motion";

type Project = {
  title: string;
  desc: string;
  tech: string[];
  repo: string | null;
  demo: string | null;
  featured?: boolean;
  emoji: string;
  gradient: string;
};

const projects: Project[] = [
  {
    title: "QAE2E — Agentic Quality Engineering",
    desc: "End-to-end agentic QA platform: 6 specialist agents (RI → MT → AS → EX → DO → IQ) turn a requirement into analysis, editable coverage, Playwright automation, Docker-executed evidence, and release-confidence intelligence. Connects Jira, Confluence, Figma, GitHub, Zephyr, TestRail, and ships a real MCP server.",
    tech: ["Next.js 16", "OpenRouter", "Vercel Postgres", "Pinecone", "MCP", "Docker"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qae2e",
    demo: "https://qae2e.vercel.app",
    featured: true,
    emoji: "🤖",
    gradient: "from-amber-500 to-orange-400",
  },
  {
    title: "QA AI Dashboard",
    desc: "Unified platform: resume-job matcher (LLM-scored), QA interview prep RAG chat, test case generator from PRDs, AI learning tutor, document Q&A.",
    tech: ["Next.js 16", "PostgreSQL", "Prisma", "Pinecone", "OpenRouter"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qadashboard",
    demo: "https://qadashboard-lime.vercel.app",
    emoji: "📊",
    gradient: "from-sky-500 to-blue-400",
  },
  {
    title: "QA Jobs Portal",
    desc: "Free daily India QA jobs portal. AI-extracted QA job listings from multiple sources — company, location, posted date, and eligibility — curated for QA engineers and refreshed every day.",
    tech: ["Next.js 16", "PostgreSQL", "Prisma", "OpenRouter", "AI Extraction"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/job-details",
    demo: "https://qajobs.vercel.app",
    featured: true,
    emoji: "💼",
    gradient: "from-emerald-500 to-teal-400",
  },
  {
    title: "QA Interview Preparation Kit",
    desc: "RAG-powered interview prep: PDF/DOCX knowledge base indexed into Pinecone, streaming QA assistant with grounded citations, and topic-organized Q&A browser.",
    tech: ["Next.js 14", "OpenRouter", "Pinecone", "Tailwind"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qa-interview-preparation-kit",
    demo: "https://qa-interview-preparation.vercel.app",
    emoji: "🎯",
    gradient: "from-violet-500 to-purple-400",
  },
  {
    title: "QA RAG Platform",
    desc: "Upload documents, ask AI-powered questions with grounded citations. Supports PDF/DOCX/TXT/MD, smart chunking, configurable embeddings, Pinecone vector search.",
    tech: ["Next.js 14", "OpenRouter", "Pinecone", "Mammoth", "Tailwind"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qaragplatform",
    demo: "https://qaragplatform.vercel.app",
    emoji: "📚",
    gradient: "from-rose-500 to-pink-400",
  },
  {
    title: "AI Test Architect (QA Copilot)",
    desc: "Multi-agent LangGraph system: PRD → test case generation, bug → regression selection, framework migration (Selenium → Playwright), Docker-sandboxed test execution.",
    tech: ["LangGraph", "FastAPI", "ChromaDB", "Next.js", "Docker"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/ai-testarchitect",
    demo: null,
    emoji: "🧠",
    gradient: "from-indigo-500 to-blue-400",
  },
  {
    title: "Resume Job RAG",
    desc: "Full-stack RAG pipeline for QA job seekers. Upload resume → AI profile extraction → multi-source job search → eligibility filtering → LLM-ranked matches.",
    tech: ["React", "Express", "ChromaDB", "OpenRouter"],
    repo: "https://github.com/TarunBabbar/resume-job-rag",
    demo: null,
    emoji: "📄",
    gradient: "from-teal-500 to-emerald-400",
  },
  {
    title: "8-Layer Playwright Framework",
    desc: "Enterprise-grade Playwright framework with strict 8-layer architecture — POM, modules, fixtures, API layer, custom reporting, Docker, and sharding.",
    tech: ["Playwright", "TypeScript", "Docker", "GitHub Actions"],
    repo: "https://github.com/TarunBabbar/8layer-advance-playwright-framework",
    demo: null,
    emoji: "🎭",
    gradient: "from-orange-500 to-amber-400",
  },
  {
    title: "Self-Healing Playwright Framework",
    desc: "AI-powered self-healing test framework using GPT-4 to detect and fix broken locators automatically when UI changes.",
    tech: ["Playwright", "GPT-4", "OpenAI", "TypeScript"],
    repo: "https://github.com/TarunBabbar/SelfHealingPlaywrightFramework",
    demo: null,
    emoji: "🩹",
    gradient: "from-fuchsia-500 to-pink-400",
  },
];

export default function Projects() {
  return (
    <section id="projects" className="py-14 sm:py-16">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Projects
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em] mb-2">
            Built to Solve Real Problems
          </h2>
          <p className="text-text-secondary max-w-xl leading-relaxed">
            AI-augmented QA platforms, RAG pipelines, agent systems, and
            production-grade test frameworks — all built in the last year.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <ProjectCard key={p.title} project={p} i={i} />
          ))}
        </div>
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
      className={`relative flex flex-col bg-surface border rounded-xl p-5 transition-all group ${
        p.featured
          ? "border-amber-400/60 shadow-md shadow-amber-500/10 hover:shadow-xl hover:-translate-y-1"
          : "border-border hover:shadow-lg hover:-translate-y-1"
      }`}
    >
      {/* Top accent gradient */}
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r ${p.gradient}`} />

      {/* Icon + title */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-lg text-white shadow-sm shrink-0`}>
          {p.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-[15px] leading-snug">{p.title}</h4>
          {p.featured && (
            <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
              ★ Featured
            </span>
          )}
        </div>
      </div>

      <p className="text-[13px] text-text-secondary leading-relaxed mb-4 flex-1">{p.desc}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {p.tech.map((t) => (
          <span
            key={t}
            className="text-[11px] font-mono font-medium bg-cream-alt border border-border px-2 py-0.5 rounded"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="flex gap-3 border-t border-border pt-3">
        {p.repo && (
          <a href={p.repo} target="_blank" className="text-xs font-semibold text-amber-600 group-hover:underline inline-flex items-center gap-1">
            GitHub
            <span aria-hidden>→</span>
          </a>
        )}
        {p.demo && (
          <a href={p.demo} target="_blank" className="text-xs font-semibold text-text-secondary group-hover:text-amber-700 group-hover:underline inline-flex items-center gap-1">
            Live Demo
            <span aria-hidden>→</span>
          </a>
        )}
      </div>
    </motion.div>
  );
}
