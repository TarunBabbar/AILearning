"use client";

import { motion } from "framer-motion";

const techs = [
  "LangGraph", "ChromaDB", "FastAPI", "Next.js 16", "Tailwind CSS",
  "Claude API", "OpenRouter", "Docker", "Playwright", "PostgreSQL",
  "MCP Servers", "tree-sitter AST",
];

const archNodes = [
  { label: "PRD / JIRA", active: true },
  { label: "Orchestrator", active: true },
  { label: "Test Generator", active: true },
  { label: "Regression Selector", active: true },
  { label: "Execution Engine", active: false },
  { label: "Result Analyzer", active: false },
];

export default function CurrentlyBuilding() {
  return (
    <section className="py-20 sm:py-28 bg-surface">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Now Building
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em] mb-2">
            AI Test Copilot
          </h2>
          <p className="text-text-secondary max-w-xl mb-10 leading-relaxed">
            A multi-agent QA platform that reimagines test automation — from PRD to
            execution, powered by LangGraph, vector search, and LLMs.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-gradient-to-br from-surface to-amber-50 border border-border rounded-xl p-8 sm:p-10 shadow-lg"
        >
          <div className="flex items-center gap-3 mb-5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-400" />
            <h3 className="text-xl font-bold">
              QA Copilot — Agentic Test Automation Framework
            </h3>
          </div>

          <p className="text-text-secondary leading-relaxed mb-6">
            This isn&apos;t another test runner. It&apos;s an autonomous AI system that
            ingests PRDs, generates structured test cases, selects regression suites
            by semantic similarity to bugs, migrates Selenium Java to Playwright
            TypeScript automatically, and executes tests in sandboxed Docker
            containers — all through a Claude-like chat interface.
          </p>

          <div className="flex flex-wrap gap-2 mb-6">
            {techs.map((t, i) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className={`px-3 py-1 text-xs font-mono font-medium rounded-md border ${
                  i < 4
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-700"
                    : "bg-cream-alt border-border text-text-secondary"
                }`}
              >
                {t}
              </motion.span>
            ))}
          </div>

          {/* Architecture flow */}
          <div className="hidden sm:flex items-center flex-wrap gap-2 bg-surface border border-border rounded-lg p-4">
            {archNodes.map((node, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-text-muted text-sm font-mono">→</span>
                )}
                <span
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
                    node.active
                      ? "bg-amber-500/10 border-amber-400 text-amber-700"
                      : "bg-cream border-border text-text-muted"
                  }`}
                >
                  {node.label}
                </span>
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
