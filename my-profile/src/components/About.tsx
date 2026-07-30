"use client";

import { motion } from "framer-motion";

const highlights = [
  "Selenium WebDriver & Playwright",
  "RAG & Vector DBs (ChromaDB, Pinecone)",
  "Multi-Agent Orchestration (LangGraph)",
  "MCP Protocol for Tool Integration",
  "Azure DevOps & GitHub Actions",
  "C#, TypeScript, Python",
  "BDD / SpecFlow / Cucumber",
  "CI/CD & Quality Gates",
];

export default function About() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
              About
            </div>
            <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em] mb-4 leading-tight">
              Architect of Quality.<br />Builder of AI Systems.
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              I design and build test automation frameworks that merge classical QA
              engineering with modern AI — RAG pipelines, multi-agent orchestration,
              vector databases, and LLM-driven test generation. From Selenium to
              Playwright, from C# to TypeScript to Python, I ship frameworks that
              teams actually want to use.
            </p>
            <p className="text-text-secondary leading-relaxed">
              Currently building an{" "}
              <strong className="text-text">AI Test Copilot</strong> — a LangGraph
              multi-agent system that generates test cases from PRDs, selects
              regression suites via semantic search, migrates frameworks
              automatically, and executes tests in sandboxed containers.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
          >
            {highlights.map((h, i) => (
              <motion.div
                key={h}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="flex items-center gap-2.5 bg-cream-alt px-4 py-3 rounded-lg text-sm font-medium"
              >
                <span className="w-1.5 h-1.5 min-w-[6px] rounded-full bg-amber-500" />
                {h}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
