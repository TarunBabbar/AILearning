"use client";

import { motion } from "framer-motion";

const categories = [
  {
    title: "🤖 AI & Agentic QA",
    top: [
      "Multi-Agent Orchestration",
      "DeepEval (AI Output Evaluation)",
      "LLM-as-a-Judge",
      "RAG Pipelines",
      "Prompt Engineering",
    ],
    rest: ["LangGraph", "CrewAI", "MCP Protocol", "Self-Healing Tests", "AI Observability", "Model Routing"],
  },
  {
    title: "🧪 Test Automation",
    top: ["Playwright", "TypeScript", "Selenium WebDriver", "BDD / SpecFlow / Cucumber"],
    rest: ["Pytest", "Cypress", "Appium", "REST Assured", "Postman", "NUnit / TestNG / JUnit", "k6 / JMeter"],
  },
  {
    title: "🔧 Platforms & Workflow",
    top: ["Azure DevOps", "TFS", "YAML Pipelines (CI/CD)", "Blazor App Testing"],
    rest: ["GitHub Actions", "Jenkins", "Docker", "Kubernetes", "Git", "Figma-to-Code Workflows"],
  },
  {
    title: "💻 Languages",
    top: ["TypeScript", "C# .NET", "Python"],
    rest: ["JavaScript", "Java", "SQL"],
  },
  {
    title: "🗄 Vector DBs & Data",
    top: ["ChromaDB", "Pinecone"],
    rest: ["pgvector", "PostgreSQL", "SQLite", "Neon", "ETL Testing"],
  },
  {
    title: "🏗 Frameworks & Architecture",
    top: ["Page Object Model", "SOLID Principles", "8-Layer Framework Architecture"],
    rest: ["Microservices", "Next.js", "FastAPI", "Express", "REST APIs & Token Auth"],
  },
];

export default function Skills() {
  return (
    <section id="skills" className="py-20 sm:py-24 bg-bg">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Expertise
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em] mb-3">
            Skills & Technologies
          </h2>
          <p className="text-text-secondary mb-12 leading-relaxed">
            Enterprise-grade automation meets modern AI — agent orchestration, evaluated LLM output, and full-stack testing.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="card-accent bg-bg-card border border-border rounded-xl p-6 hover:border-amber-400/70 transition-colors"
            >
              <h4 className="text-sm font-bold mb-4 text-text">{cat.title}</h4>
              <div className="flex flex-wrap gap-1.5">
                {cat.top.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-md"
                  >
                    {s}
                  </span>
                ))}
                {cat.rest.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 text-xs font-medium bg-bg-soft border border-border text-text-secondary rounded-md hover:border-amber-400 hover:text-amber-700 transition-colors"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
