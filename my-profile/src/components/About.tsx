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

type IntroPoint = { title: string; body: string };

const introPoints: IntroPoint[] = [
  {
    title: "18+ years in QA engineering",
    body: "Service orgs to product companies — Infosys, TCS, Varian and Coupa — now AI-native quality engineering.",
  },
  {
    title: "Solutions Architect at Coforge Limited",
    body: "Based in Pune, currently at client location Xplor Technologies, Kharadi.",
  },
  {
    title: "10+ AI apps and agentic systems shipped",
    body: "RAG pipelines, agentic QA copilots, and the QAE2E pipeline that took the hackathon.",
  },
  {
    title: "🏆 1st place — AI Tester Blueprint 3x hackathon",
    body: "60+ participants, for QAE2E — an agentic QA pipeline judged end-to-end by an AI.",
  },
  {
    title: "0 → 100% automation adoption",
    body: "Teams taken from fully manual regression to fully automated across 3+ product lines.",
  },
  {
    title: "Open to Architect / Principal SDET / QA Head roles",
    body: "Focused on one scalable AI platform that multiple teams onboard to.",
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

            <ul className="space-y-2.5">
              {introPoints.map((point) => (
                <li key={point.title} className="flex gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 min-w-[6px] rounded-full bg-amber-500" />
                  <span className="min-w-0 text-sm leading-relaxed text-text-secondary">
                    <strong className="text-text">{point.title}</strong>
                    <span className="mt-0.5 block">{point.body}</span>
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
