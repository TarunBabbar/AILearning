import { Card } from "@/components/ui/Card";
import { Check } from "lucide-react";

const integrations = [
  "Jira",
  "Confluence",
  "Figma",
  "GitHub",
  "Zephyr",
  "TestRail",
  "Pinecone",
  "Docker",
  "Playwright",
];

const pillars = [
  { code: "PR", title: "Product context", text: "Manage products, modules, requirements, analyses, and coverage in one place instead of scattered documents and spreadsheets." },
  { code: "TR", title: "Traceability by design", text: "Follow the thread from source requirement to AI analysis, generated tests, execution result, and defect." },
  { code: "RL", title: "Release intelligence", text: "See test-cycle progress, execution confidence, active risks, and the work that still needs attention." },
  { code: "AI", title: "Model-flexible intelligence", text: "Run AI analysis with the model strategy that fits your environment, including local and enterprise options." },
];

export function Integrations() {
  return (
    <section id="integrations" className="border-y border-border bg-bg-surface/50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Integration-first</p>
        <h2 className="mt-2.5 max-w-2xl text-3xl font-bold text-text-primary leading-tight">
          A shared quality workspace for product, QA, engineering, and leaders.
        </h2>

        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pillars.map((p) => (
            <Card key={p.code} hover className="p-6">
              <div className="flex items-center gap-2 text-amber-700">
                <Check size={16} />
                <span className="text-xs font-black tracking-wide">{p.code}</span>
              </div>
              <h3 className="mt-3 font-semibold text-text-primary">{p.title}</h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">{p.text}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-2.5">
          {integrations.map((i) => (
            <span key={i} className="px-4 py-2 rounded-full border border-border bg-bg-page text-sm font-semibold text-text-secondary">
              {i}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
