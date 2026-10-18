"use client";

import { motion } from "framer-motion";

type Pipeline = {
  badge: string;
  title: string;
  subtitle: string;
  inputs: string[];
  steps: string[];
  outputs: string[];
};

const pipelines: Pipeline[] = [
  {
    badge: "Pipeline 1",
    title: "Test Case Generation",
    subtitle: "JIRA + Figma → reviewed, de-duplicated test cases published to TFS",
    inputs: ["JIRA stories", "Figma designs"],
    steps: [
      "JIRA stories and Figma designs are ingested as the requirement source.",
      "Requirements are generated and refined directly from the designs.",
      "A generation agent turns each requirement into test cases.",
      "Duplicate and near-identical scenarios are auto-detected and merged before they multiply.",
      "Every AI output is evaluated against quality metrics with DeepEval (LLM-as-a-judge).",
      "Reviewed cases are published to TFS over REST APIs using token auth.",
    ],
    outputs: ["Test cases in TFS", "Traceable to the source story"],
  },
  {
    badge: "Pipeline 2",
    title: "Automation Code Generation",
    subtitle:
      "Selected test cases → running Playwright specs, generated into the existing framework",
    inputs: [
      "Figma",
      "Test cases",
      "Existing TS + Playwright framework",
      "Product code",
    ],
    steps: [
      "Inputs are assembled: Figma, the selected test cases, the existing TS + Playwright framework, and the product code.",
      "Product-code information and the live DOM are read to locate the elements each test acts on.",
      "A Skills.md file is generated — the automation recipe for the selected test cases.",
      "Automation code is generated: new specs, page files, helpers and whatever artifacts the tests need, following the existing framework structure.",
      "The generated tests are executed.",
      "Failures are fixed using live DOM element capture over MCP Playwright — real elements, not guesses.",
      "Tests are re-run until green, then the code is pushed to a new branch for review.",
    ],
    outputs: [
      "New specs, page files and helpers",
      "Run-verified build",
      "Pushed to a new branch",
    ],
  },
];

export default function Pipelines() {
  return (
    <section id="pipelines" className="py-12 sm:py-16 bg-bg">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            AI QA Platform
          </div>
          <h2 className="text-[clamp(1.5rem,2.6vw,2rem)] font-extrabold tracking-[-0.02em] mb-3 leading-tight">
            Two pipelines: requirement to test case, test case to running automation.
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed max-w-3xl mb-8">
            The multi-agent platform I&apos;m building at{" "}
            <strong className="text-text">Coforge Limited</strong> for client{" "}
            <strong className="text-text">Xplor Technologies</strong> is split into
            two pipelines. The first turns JIRA stories and Figma designs into
            reviewed, de-duplicated test cases. The second takes selected test
            cases and generates working Playwright automation into the existing
            framework — then runs it, heals its own failures against the live DOM,
            and pushes the result to a new branch.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-4">
          {pipelines.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="flex flex-col bg-bg-card border border-border rounded-xl p-5 sm:p-6 hover:border-amber-400 transition-colors"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded">
                  {p.badge}
                </span>
              </div>

              <h3 className="font-bold text-lg text-text tracking-[-0.01em]">
                {p.title}
              </h3>
              <p className="text-[13px] text-text-muted leading-relaxed mt-1">
                {p.subtitle}
              </p>

              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-amber-600 mb-2">
                  Inputs
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.inputs.map((input) => (
                    <span
                      key={input}
                      className="text-[12px] font-medium text-text-secondary bg-bg-soft border border-border px-2 py-1 rounded-md"
                    >
                      {input}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-amber-600 mb-3">
                  How it runs
                </div>
                <ol className="space-y-2.5">
                  {p.steps.map((step, j) => (
                    <li key={j} className="flex gap-3">
                      <span className="mt-[1px] flex h-5 w-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                        {j + 1}
                      </span>
                      <span className="text-[13px] text-text-secondary leading-relaxed">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-5 pt-4 border-t border-border">
                <div className="text-[10px] font-bold uppercase tracking-[1.5px] text-amber-600 mb-2">
                  Output
                </div>
                <ul className="space-y-1">
                  {p.outputs.map((output) => (
                    <li
                      key={output}
                      className="flex items-center gap-2 text-[13px] font-medium text-text-secondary"
                    >
                      <span className="w-1.5 h-1.5 min-w-[6px] rounded-full bg-green-500" />
                      {output}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-4 flex flex-wrap items-center gap-2 bg-bg-card border border-border rounded-xl px-5 py-4"
        >
          <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-amber-600 mr-1">
            Shared guardrails
          </span>
          {[
            "DeepEval on every AI output",
            "Auto duplicate-scenario detection",
            "MCP Playwright live DOM capture",
            "Azure DevOps YAML CI",
            "Push to a new branch, never to main",
          ].map((item) => (
            <span
              key={item}
              className="text-[12px] font-medium text-text-secondary bg-bg-soft border border-border px-2.5 py-1 rounded-md"
            >
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
