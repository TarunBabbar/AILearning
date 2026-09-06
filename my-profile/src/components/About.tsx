"use client";

import { motion } from "framer-motion";

const highlights = [
  "AI-Powered QA Platforms",
  "Multi-Agent Orchestration",
  "DeepEval-Driven Output Validation",
  "Auto Duplicate Scenario Detection",
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

export default function About() {
  return (
    <section id="about" className="py-20 sm:py-24 bg-bg">
      <div className="max-w-6xl mx-auto px-6">
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
            <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em] mb-5 leading-tight">
              Architect of Quality. Builder of AI Systems.
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4">
              I&apos;m an AI QA Architect and Test Automation Engineer with 18+
              years of experience — currently designing AI-driven quality
              engineering at{" "}
              <strong className="text-text">Coforge Limited</strong> for client{" "}
              <strong className="text-text">Xplor Technologies, Pune</strong>.
              I build multi-agent pipelines where AI writes requirements,
              converts them into test cases —{" "}
              <strong className="text-text">
                auto-detecting duplicate or near-identical scenarios
              </strong>{" "}
              before they multiply — evaluates every output with
              <strong className="text-text"> DeepEval</strong>, and makes
              model-driven decisions through{" "}
              <strong className="text-text">agentic prompting</strong> — before
              driving the automation itself.
            </p>
            <p className="text-text-secondary leading-relaxed">
              From service-based orgs to product companies, I&apos;ve taken teams
              from <strong className="text-text">no automation to 100%
              automation adoption</strong>. Today I combine enterprise Playwright
              + TypeScript frameworks with agentic AI — turning QA from a
              bottleneck into an accelerator. My focus now is{" "}
              <strong className="text-text">
                organisation-wide impact
              </strong>
              : one scalable, maintainable AI platform that multiple teams
              onboard to, delivering consistent quality outputs across the
              enterprise.
            </p>
            <p className="text-text-secondary leading-relaxed mt-4">
              <strong className="text-text">1st place</strong> at The Testing
              Academy&apos;s <em>AI Tester Blueprint 3x</em> hackathon (60+
              participants) for{" "}
              <strong className="text-text">QAE2E</strong>, an agentic QA pipeline
              that ships requirements to release-confidence — evaluated and
              refined end-to-end by an AI judge.
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
                className="flex items-center gap-2.5 bg-bg-card border border-border px-4 py-3 rounded-lg text-sm font-medium text-text-secondary hover:border-amber-400 hover:text-text transition-colors"
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
