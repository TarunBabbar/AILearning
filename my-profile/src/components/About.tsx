"use client";

import { motion } from "framer-motion";

const highlights = [
  "AI-Powered QA Platforms",
  "Multi-Agent Orchestration",
  "DeepEval-Driven Output Validation",
  "Auto Duplicate Scenario Detection",
  "Test Case Generation: JIRA + Figma → TFS",
  "Automation Generation into an Existing Framework",
  "Skills.md-Driven Automation Recipes",
  "Live DOM Healing via MCP Playwright",
  "Generated Specs, Page Files & Helpers",
  "Playwright + TypeScript Frameworks",
  "Figma → Requirements → Test Cases",
  "TFS / Azure DevOps Integration",
  "RAG & Vector DBs (ChromaDB, Pinecone)",
  "LLM Evaluation & Guardrails",
  "Enterprise CI/CD & YAML Pipelines",
  "0 → 100% Automation Adoption",
  "Framework Architecture & Mentorship",
  "MCP Protocol for Tool Integration",
];

type IntroPoint = { title: string; body: string; flow?: string };

const introPoints: IntroPoint[] = [
  {
    title: "Test cases from the source",
    flow: "JIRA + Figma + product code → Test Plan → DeepEval → Test Case Generator → DeepEval → pull TFS → verify duplicates → approval → push test cases",
    body: "The approval gate stays automatic unless duplicates surface or the DeepEval score is low — then it waits for a human.",
  },
  {
    title: "Automation generated, not hand-written",
    flow: "test cases + Figma + product code → Skills.md (skill file) → LLM generates automation → run tests → on failure: live DOM detector → fix → re-run → new branch",
    body: "The skill file is built by reading the test cases, Figma and the product code, then handed to the LLM to generate specs, page files and helpers into our existing Playwright + TypeScript framework. Failures are detected against the live DOM and fixed before the code is pushed to a new branch.",
  },
  {
    title: "Impact",
    body: "Teams taken from no automation to 100% adoption — now building one scalable platform multiple teams onboard to.",
  },
  {
    title: "🏆 1st place",
    body: "The Testing Academy's AI Tester Blueprint 3x hackathon, for QAE2E — an agentic QA pipeline judged end-to-end by an AI.",
  },
];

export default function About() {
  return (
    <section id="about" className="py-12 sm:py-16 bg-bg">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
              About
            </div>
            <h2 className="text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold tracking-[-0.02em] mb-3 leading-tight">
              Architect of Quality. Builder of AI Systems.
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              I&apos;m an AI QA Architect and Test Automation Engineer with 18+
              years of experience — currently designing AI-driven quality
              engineering at{" "}
              <strong className="text-text">Coforge Limited</strong> for client{" "}
              <strong className="text-text">Xplor Technologies, Pune</strong>,
              building multi-agent pipelines that take QA from requirement to
              running automation.
            </p>

            <ul className="space-y-3">
              {introPoints.map((point) => (
                <li key={point.title} className="flex gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 min-w-[6px] rounded-full bg-amber-500" />
                  <span className="min-w-0 text-sm text-text-secondary leading-relaxed">
                    <strong className="text-text">{point.title}</strong>
                    {point.flow && (
                      <span className="mt-1.5 block rounded-md border border-border bg-bg-soft px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-text-secondary">
                        {point.flow}
                      </span>
                    )}
                    <span className="mt-1 block">{point.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            {highlights.map((h, i) => (
              <motion.div
                key={h}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="flex items-center gap-2 bg-bg-card border border-border px-3 py-2 rounded-lg text-[13px] font-medium text-text-secondary hover:border-amber-400 hover:text-text transition-colors"
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
