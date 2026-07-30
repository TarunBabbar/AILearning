"use client";

import { motion } from "framer-motion";

const roles = [
  {
    date: "Jan 2018 — Jun 2025",
    title: "Lead Software Engineer in Test | Test Automation Architect",
    company: "Coupa Software, Pune",
    details: [
      "Architected full-stack automation suite (UI, API, DB, E2E) — transitioned 100% manual regression to 100% automated across 3+ product lines",
      "Delivered 100+ major UI automation cases in 9 months using C#.NET + Selenium, reducing manual regression by ~70%",
      "Built 50+ integration and 50+ API/database validation cases in 4 months, cutting production defects by ~40%",
      "Architected environment-agnostic CI/CD with Azure Pipelines + GitHub Actions, reducing deployment time by 30%",
      "Led, coached, and mentored 6 QA engineers — improved script maintainability by 30%, reduced script defects by 20%",
    ],
  },
  {
    date: "Aug 2016 — Dec 2017",
    title: "SW QA Engineer IV",
    company: "Varian Medical Systems, Pune",
    details: [
      "Designed Selenium UI automation + VSTS performance frameworks, reducing regression time by 30%",
      "Built WPF, MVC, and JavaScript integration testing utilities, saving ~4 hours/week across QA team",
      "Spearheaded cross-team API automation strategy, reducing manual API testing by 50%",
      "Championed SOLID principles and coding standards across 2 engineering teams",
    ],
  },
  {
    date: "Aug 2010 — Aug 2016",
    title: "Assistant Consultant",
    company: "Tata Consultancy Services, Pune",
    details: [
      "Architected enterprise test automation frameworks (C#.NET, Selenium, SpecFlow, Coded UI) — cut manual testing by 50%, boosted coverage by 20%",
      "Migrated legacy KAF to Selenium with Abstract Factory pattern — 40% faster test execution",
      "Owned CI/CD pipeline architecture and BDD strategy across 3+ development teams",
      "Reduced onboarding time by 30% through structured training for 10+ new hires",
    ],
  },
  {
    date: "Feb 2007 — Jul 2010",
    title: "Senior Systems Engineer",
    company: "Infosys Technologies, Pune",
    details: [
      "Validated 50% of critical Windows OS components across 2 dev teams, reducing critical bugs by 10% pre-release",
      "Automated 30+ manual workflows, reducing processing time by 40%",
      "Identified 50+ defects, validated 20+ Design Change Requests, reduced resolution time by 40%",
    ],
  },
];

export default function Career() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Career
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em] mb-2">
            Professional Path
          </h2>
          <p className="text-text-secondary max-w-xl mb-10 leading-relaxed">
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
              className={`relative pb-10 last:pb-0 ${i === 0 ? "current" : ""}`}
            >
              <span
                className={`absolute -left-[calc(2rem+5px)] top-1 w-4 h-4 rounded-full border-2 bg-surface ${
                  i === 0
                    ? "border-amber-500 bg-amber-500 shadow-[0_0_0_4px_rgba(217,119,6,0.15)]"
                    : "border-amber-400"
                }`}
              />
              <div className="text-xs font-semibold text-amber-600 uppercase tracking-[0.5px] mb-1">
                {r.date}
              </div>
              <h4 className="font-bold text-base">{r.title}</h4>
              <div className="text-sm text-text-secondary mb-1.5">{r.company}</div>
              <ul className="space-y-1">
                {r.details.map((d, j) => (
                  <li key={j} className="text-sm text-text-muted leading-relaxed flex gap-2">
                    <span className="text-amber-500 mt-1.5 min-w-[5px]">•</span>
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
