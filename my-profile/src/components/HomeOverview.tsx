"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PAGES } from "@/lib/site";

const pillars = [
  {
    icon: "🧠",
    title: "AI-Native Quality Engineering",
    body: "Multi-agent QA pipelines that carry a requirement through to release-ready confidence — every AI output scored with DeepEval and gated by model-driven decisions.",
  },
  {
    icon: "🔗",
    title: "Agent Orchestration",
    body: "Requirements, test cases and automation generated, validated and self-healed by cooperating agents wired into JIRA, Figma, TFS and MCP Playwright.",
  },
  {
    icon: "🏗",
    title: "Enterprise Test Architecture",
    body: "8-layer Playwright + TypeScript frameworks, Azure DevOps CI/CD, and 0 → 100% automation adoption across multiple product lines.",
  },
];

export default function HomeOverview() {
  const pages = PAGES.filter((page) => page.href !== "/");

  return (
    <>
      {/* What I do */}
      <section className="py-16 sm:py-20 bg-bg">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-10 max-w-2xl"
          >
            <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
              What I Do
            </div>
            <h2 className="text-[clamp(1.5rem,2.8vw,2.1rem)] font-extrabold tracking-[-0.02em] mb-3">
              Quality Engineering, Rebuilt for the AI Era
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              I combine 18+ years of test architecture with modern agentic AI — so quality is generated, evaluated and maintained by systems that scale far beyond manual effort.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-3">
            {pillars.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="card-accent rounded-xl border border-border bg-bg-card p-6 hover:border-amber-400/70 transition-colors"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-xl">
                  {p.icon}
                </div>
                <h3 className="mb-2 font-bold text-text">{p.title}</h3>
                <p className="text-sm leading-relaxed text-text-secondary">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore the pages */}
      <section className="py-16 sm:py-20 bg-bg-soft border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4"
          >
            <div>
              <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
                Explore the Portfolio
              </div>
              <h2 className="text-[clamp(1.5rem,2.8vw,2.1rem)] font-extrabold tracking-[-0.02em]">
                Every section, its own page
              </h2>
            </div>
            <p className="text-sm text-text-secondary max-w-md leading-relaxed">
              Jump straight to the part you need — every section has its own page
              with the full detail.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((page, i) => (
              <motion.div
                key={page.href}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3) }}
              >
                <Link
                  href={page.href}
                  className="card-accent group flex h-full flex-col rounded-xl border border-border bg-bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:bg-bg-card-hover hover:shadow-md"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-soft text-lg">
                      {page.icon}
                    </span>
                    <h3 className="font-bold text-text">{page.label}</h3>
                  </div>
                  <p className="flex-1 text-[13px] leading-relaxed text-text-secondary">
                    {page.blurb}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-amber-600 group-hover:text-amber-700">
                    Open
                    <span aria-hidden>→</span>
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
