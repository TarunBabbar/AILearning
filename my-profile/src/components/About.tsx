"use client";

import { motion } from "framer-motion";

const highlights = [
  "Service & Product Org Leadership",
  "0 → 100% Automation Adoption",
  "AI QA Transformation",
  "Selenium WebDriver & Playwright",
  "RAG & Vector DBs (ChromaDB, Pinecone)",
  "Multi-Agent Orchestration (LangGraph)",
  "MCP Protocol for Tool Integration",
  "Azure DevOps & GitHub Actions",
  "C#, TypeScript, Python",
  "BDD / SpecFlow / Cucumber",
  "CI/CD & Quality Gates",
  "Framework Architecture & Mentorship",
];

export default function About() {
  return (
    <section id="about" className="py-20 sm:py-28">
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
              I lead quality engineering across both{" "}
              <strong className="text-text">service-based</strong> and{" "}
              <strong className="text-text">product-based</strong> organisations,
              architecting test automation and AI-augmented quality programs that
              scale with the business. I&apos;ve taken teams from{" "}
              <strong className="text-text">no automation to 100% automation
              adoption</strong> — building the frameworks, CI/CD pipelines, and
              engineering culture to make it stick.
            </p>
            <p className="text-text-secondary leading-relaxed">
              Today I drive <strong className="text-text">AI in Quality
              Engineering</strong> — LLM-driven test generation, RAG pipelines,
              multi-agent orchestration, and vector databases that turn QA from a
              bottleneck into an accelerator. From Selenium to Playwright, from C#
              to TypeScript to Python, I ship frameworks teams actually want to
              use — and mentor the engineers who run them.
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
