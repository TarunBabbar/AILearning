"use client";

import { motion } from "framer-motion";

const roles = [
  {
    date: "Aug 2026 — Present",
    title: "AI QA Architect | Test Automation Lead",
    company: "Coforge Limited (Viman Nagar, Pune) · at Xplor Technologies (Kharadi, Pune)",
    tag: "Current",
    details: [
      "Built a Playwright + TypeScript UI test automation framework for a Blazor-based application — with Azure DevOps, TFS, and YAML pipelines for CI.",
      "Building a Multi-Agent Orchestration Framework that generates requirements from Figma designs, converts them into test cases, and publishes them to TFS through REST APIs using token auth.",
      "Every AI-generated output is evaluated against quality metrics with DeepEval — with auto-duplicate scenario/test detection to stop similar scenarios from multiplying.",
      "Generating automation code that follows the framework structure on Azure DevOps, with the full UI automation pipeline in place.",
      "Working on reading user stories and converting them into test cases — identifying which existing tests belong to each story by reading the test-case repository.",
      "Triggering automation runs automatically based on the scenarios under test, and presenting reports built with Cursor.",
    ],
  },
  {
    date: "Jul 2025 — Jul 2026",
    title: "Career Transition — AI + Test Automation R&D",
    company: "Self-Directed Learning, Pune",
    details: [
      "Deep-dived into LLMs, RAG, MCP, AI agents and orchestration tools while strengthening LangChain, Playwright and TypeScript.",
      "Shipped 10+ AI applications — RAG pipelines, agentic QA copilots and the QAE2E pipeline that took 1st place at The Testing Academy's AI Tester Blueprint 3x hackathon.",
      "Core focus: test architecture & strategy, CI/CD and DevOps, and AI-native quality engineering.",
    ],
  },
  {
    date: "Jan 2018 — Jun 2025",
    title: "Lead Software Engineer in Test | Test Automation Architect",
    company: "Coupa Software, Pune",
    details: [
      "Architected full-stack automation suite (UI, API, DB, E2E) — transitioned 100% manual regression to 100% automated across 3+ product lines.",
      "Delivered 100+ major UI automation cases in 9 months using C#.NET + Selenium, reducing manual regression by ~70%.",
      "Built 50+ integration and 50+ API/database validation cases in 4 months, cutting production defects by ~40%.",
      "Architected environment-agnostic CI/CD with Azure Pipelines + GitHub Actions, reducing deployment time by 30%.",
      "Led, coached, and mentored 6 QA engineers — improved script maintainability by 30%, reduced script defects by 20%.",
    ],
  },
  {
    date: "Aug 2016 — Dec 2017",
    title: "SW QA Engineer IV",
    company: "Varian Medical Systems, Pune",
    details: [
      "Designed Selenium UI automation + VSTS performance frameworks, reducing regression time by 30%.",
      "Built WPF, MVC, and JavaScript integration testing utilities, saving ~4 hours/week across the QA team.",
      "Spearheaded cross-team API automation strategy, reducing manual API testing by 50%.",
      "Championed SOLID principles and coding standards across 2 engineering teams.",
    ],
  },
  {
    date: "Aug 2010 — Aug 2016",
    title: "Assistant Consultant",
    company: "Tata Consultancy Services, Pune",
    details: [
      "Architected enterprise test automation frameworks (C#.NET, Selenium, SpecFlow, Coded UI) — cut manual testing by 50%, boosted coverage by 20%.",
      "Migrated legacy KAF to Selenium with the Abstract Factory pattern — 40% faster test execution.",
      "Owned CI/CD pipeline architecture and BDD strategy across 3+ development teams.",
      "Reduced onboarding time by 30% through structured training for 10+ new hires.",
    ],
  },
  {
    date: "Feb 2007 — Jul 2010",
    title: "Senior Systems Engineer",
    company: "Infosys Technologies, Pune",
    details: [
      "Validated 50% of critical Windows OS components across 2 dev teams, reducing critical bugs by 10% pre-release.",
      "Automated 30+ manual workflows, reducing processing time by 40%.",
      "Identified 50+ defects, validated 20+ Design Change Requests, reduced resolution time by 40%.",
    ],
  },
];

export default function Career() {
  return (
    <section id="career" className="py-20 sm:py-24 bg-bg-soft">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Career
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em] mb-3">
            Professional Path
          </h2>
          <p className="text-text-secondary max-w-xl mb-12 leading-relaxed">
            From quality engineering to AI-augmented test architecture — building
            systems that ship quality at scale.
          </p>
        </motion.div>

        <div className="relative pl-8 border-l-2 border-border">
          {roles.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative pb-10 last:pb-0"
            >
              <span
                className={`absolute -left-[calc(2rem+5px)] top-1 w-4 h-4 rounded-full border-2 bg-bg ${
                  i === 0
                    ? "border-amber-500 bg-amber-500"
                    : "border-amber-500"
                }`}
              />
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-[0.5px]">
                  {r.date}
                </span>
                {r.tag && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded">
                    {r.tag}
                  </span>
                )}
              </div>
              <h4 className="font-bold text-base text-text">{r.title}</h4>
              <div className="text-sm text-text-secondary mb-2">{r.company}</div>
              <ul className="space-y-1.5">
                {r.details.map((d, j) => (
                  <li key={j} className="text-sm text-text-muted leading-relaxed flex gap-2">
                    <span className="text-amber-500 leading-none mt-[7px] select-none">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
