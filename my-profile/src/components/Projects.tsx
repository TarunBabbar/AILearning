"use client";

import { motion } from "framer-motion";

const projects = [
  {
    title: "QA RAG Platform",
    desc: "Upload documents, ask AI-powered questions with grounded citations. Supports PDF/DOCX/TXT/MD, smart chunking, configurable embeddings, Pinecone vector search.",
    tech: ["Next.js 14", "OpenRouter", "Pinecone", "Mammoth", "Tailwind"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qaragplatform",
  },
  {
    title: "QA AI Dashboard",
    desc: "Unified platform: resume-job matcher (LLM-scored), QA interview prep RAG chat, test case generator from PRDs, AI learning tutor, document Q&A.",
    tech: ["Next.js 15", "Neon PostgreSQL", "Prisma", "Pinecone", "OpenRouter"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/qadashboard",
  },
  {
    title: "AI Test Architect (QA Copilot)",
    desc: "Multi-agent LangGraph system: PRD → test case generation, bug → regression selection, framework migration (Selenium → Playwright), Docker-sandboxed test execution.",
    tech: ["LangGraph", "FastAPI", "ChromaDB", "Next.js", "Docker"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/ai-testarchitect",
  },
  {
    title: "Resume–Job Matcher",
    desc: "Upload resume + job listings → LLM extracts structured jobs, scores matches (0–100) with strengths/gaps, tracks status workflow. Email agent with Gmail SMTP.",
    tech: ["React 19", "Vite 8", "Express", "OpenRouter", "Nodemailer"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/resume-parser",
  },
  {
    title: "Playwright + TypeScript Framework",
    desc: "Production-grade Playwright automation framework from scratch — POM, fixtures, parallel execution, CI/CD integration, API mocking, visual testing.",
    tech: ["Playwright", "TypeScript", "Pytest", "GitHub Actions"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/learning-playwright-typescript-framework",
  },
  {
    title: "AI QA Interview Prep Kit",
    desc: "Structured prep for Senior AI QA roles — NL2SQL validation, LLM evaluation (EM, MRR, precision/recall), golden dataset design, prompt regression, RAG eval.",
    tech: ["Python", "Pytest", "LangSmith", "RAGAS", "DeepEval"],
    repo: "https://github.com/TarunBabbar/AILearning/tree/main/interview-preparation",
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
            AI Learning Projects
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em] mb-2">
            Built to Solve Real Problems
          </h2>
          <p className="text-text-secondary max-w-xl mb-10 leading-relaxed">
            Each project applies AI to a distinct QA challenge — RAG-based document
            Q&A, resume-job matching with LLM scoring, multi-agent test generation,
            and more.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="bg-surface border border-border rounded-xl p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
            >
              <h4 className="font-bold text-base mb-2">{p.title}</h4>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                {p.desc}
              </p>
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
              <a
                href={p.repo}
                target="_blank"
                className="text-xs font-semibold text-amber-600 group-hover:underline"
              >
                View project →
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
