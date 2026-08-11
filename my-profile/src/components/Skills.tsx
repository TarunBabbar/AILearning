"use client";

import { motion } from "framer-motion";

const categories = [
  {
    title: "🛠 Automation & Testing",
    top: ["Selenium WebDriver", "Playwright", "SpecFlow / BDD"],
    rest: ["Cypress", "Appium", "REST Assured", "Postman", "TestNG / JUnit", "Pytest", "Performance (k6, JMeter)"],
  },
  {
    title: "🤖 AI & LLM",
    top: ["RAG Pipelines", "Multi-Agent Orchestration", "LangGraph", "MCP Protocol"],
    rest: ["LLM Evaluation", "Prompt Engineering", "LLM-as-Judge", "Self-Healing Tests", "AI Observability"],
  },
  {
    title: "🗄 Vector DBs & Data",
    top: ["ChromaDB", "Pinecone"],
    rest: ["pgvector", "PostgreSQL", "SQLite", "Neon", "ETL Testing"],
  },
  {
    title: "🔧 Languages",
    top: ["C# .NET", "TypeScript", "Python"],
    rest: ["JavaScript", "Java", "SQL"],
  },
  {
    title: "⚡ CI/CD & DevOps",
    top: ["Azure DevOps", "GitHub Actions"],
    rest: ["Jenkins", "Docker", "Kubernetes", "Git"],
  },
  {
    title: "🏗 Frameworks & Architecture",
    top: ["Page Object Model", "SOLID Principles"],
    rest: ["Abstract Factory", "Microservices", "Next.js", "FastAPI", "Express"],
  },
];

export default function Skills() {
  return (
    <section id="skills" className="py-14 sm:py-16 bg-surface">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Expertise
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em] mb-2">
            Skills & Technologies
          </h2>
          <p className="text-text-secondary max-w-xl mb-10 leading-relaxed">
            Enterprise-grade automation meets modern AI — across the full testing
            stack.
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
              className="bg-cream border border-border rounded-xl p-6"
            >
              <h4 className="text-sm font-bold mb-4">{cat.title}</h4>
              <div className="flex flex-wrap gap-1.5">
                {cat.top.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded-md"
                  >
                    {s}
                  </span>
                ))}
                {cat.rest.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 text-xs font-medium bg-white border border-border text-text-secondary rounded-md hover:border-amber-400 hover:text-amber-700 transition-colors"
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
