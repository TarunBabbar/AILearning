"use client";

import { motion } from "framer-motion";

const projects = [
  {
    title: "QAE2E — Agentic Quality Engineering",
    desc: "End-to-end agentic QA platform: 6 specialist agents (RI → MT → AS → EX → DO → IQ) turn a requirement into analysis, editable coverage, Playwright automation, Docker-executed evidence, and release-confidence intelligence. Connects Jira, Confluence, Figma, GitHub, Zephyr, TestRail, and ships a real MCP server.",
    tech: ["Next.js 15", "OpenRouter", "Vercel Postgres", "Pinecone", "MCP", "Docker"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qae2e",
    demo: "https://qae2e.vercel.app",
  },
  {
    title: "QA AI Dashboard",
    desc: "Unified platform: resume-job matcher (LLM-scored), QA interview prep RAG chat, test case generator from PRDs, AI learning tutor, document Q&A.",
    tech: ["Next.js 15", "Neon PostgreSQL", "Prisma", "Pinecone", "OpenRouter"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qadashboard",
    demo: "https://qadashboard-lime.vercel.app",
  },
  {
    title: "QA Interview Preparation Kit",
    desc: "RAG-powered interview prep: PDF/DOCX knowledge base indexed into Pinecone, streaming QA assistant with grounded citations, and topic-organized Q&A browser.",
    tech: ["Next.js 14", "OpenRouter", "Pinecone", "Tailwind"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qa-interview-preparation-kit",
    demo: "https://qa-interview-preparation.vercel.app",
  },
  {
    title: "QA RAG Platform",
    desc: "Upload documents, ask AI-powered questions with grounded citations. Supports PDF/DOCX/TXT/MD, smart chunking, configurable embeddings, Pinecone vector search.",
    tech: ["Next.js 14", "OpenRouter", "Pinecone", "Mammoth", "Tailwind"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qaragplatform",
    demo: "https://qaragplatform.vercel.app",
  },
  {
    title: "RAG Explorer",
    desc: "Transparent 3-panel RAG pipeline visualizer. Ingest PDFs/DOCX, watch chunking → embedding → ChromaDB storage → vector search → LLM answer via SSE.",
    tech: ["React", "Vite", "ChromaDB", "OpenRouter"],
    repo: "https://github.com/TarunBabbar/chroma-react-rag-pipeline",
    demo: "https://rag-explorer.vercel.app",
  },
  {
    title: "AI Test Architect (QA Copilot)",
    desc: "Multi-agent LangGraph system: PRD → test case generation, bug → regression selection, framework migration (Selenium → Playwright), Docker-sandboxed test execution.",
    tech: ["LangGraph", "FastAPI", "ChromaDB", "Next.js", "Docker"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/ai-testarchitect",
    demo: null,
  },
  {
    title: "Resume Job RAG",
    desc: "Full-stack RAG pipeline for QA job seekers. Upload resume → AI profile extraction → multi-source job search → eligibility filtering → LLM-ranked matches.",
    tech: ["React", "Express", "ChromaDB", "OpenRouter"],
    repo: "https://github.com/TarunBabbar/resume-job-rag",
    demo: null,
  },
  {
    title: "8-Layer Playwright Framework",
    desc: "Enterprise-grade Playwright framework with strict 8-layer architecture — POM, modules, fixtures, API layer, custom reporting, Docker, and sharding.",
    tech: ["Playwright", "TypeScript", "Docker", "GitHub Actions"],
    repo: "https://github.com/TarunBabbar/8layer-advance-playwright-framework",
    demo: null,
  },
  {
    title: "Self-Healing Playwright Framework",
    desc: "AI-powered self-healing test framework using GPT-4 to detect and fix broken locators automatically when UI changes.",
    tech: ["Playwright", "GPT-4", "OpenAI", "TypeScript"],
    repo: "https://github.com/TarunBabbar/SelfHealingPlaywrightFramework",
    demo: null,
  },
  {
    title: "QA Multi-Agent Assistant",
    desc: "Multi-agent system orchestrating specialized AI agents for test case generation and automation code production from requirements.",
    tech: ["TypeScript", "AI Agents", "OpenAI"],
    repo: "https://github.com/TarunBabbar/QAMultiAgentAssistant",
    demo: null,
  },
];

export default function Projects() {
  return (
    <section id="projects" className="py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Projects
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em] mb-2">
            Built to Solve Real Problems
          </h2>
          <p className="text-text-secondary max-w-xl mb-10 leading-relaxed">
            AI-augmented QA platforms, RAG pipelines, agent systems, and
            production-grade test frameworks — all built in the last year.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p, i) => (
            <ProjectCard key={p.title} project={p} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project, i }: { project: typeof projects[0]; i: number }) {
  const p = project;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: i * 0.06 }}
      className="bg-surface border border-border rounded-xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
    >
      <h4 className="font-bold text-base mb-2">{p.title}</h4>
      <p className="text-sm text-text-secondary leading-relaxed mb-4">{p.desc}</p>
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
      <div className="flex gap-3">
        <a href={p.repo} target="_blank" className="text-xs font-semibold text-amber-600 group-hover:underline">
          GitHub →
        </a>
        {p.demo && (
          <a href={p.demo} target="_blank" className="text-xs font-semibold text-text-secondary group-hover:underline">
            Live Demo →
          </a>
        )}
      </div>
    </motion.div>
  );
}
