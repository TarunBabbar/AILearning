import { Card } from "@/components/ui/Card";

const steps = [
  {
    num: "01",
    title: "Connect your source",
    items: ["Jira stories", "Confluence knowledge", "Other requirement tools"],
    label: "Connected context",
  },
  {
    num: "02",
    title: "Analyze with AI",
    items: ["Business rules", "Acceptance criteria", "Risks and edge cases"],
    label: "Requirement intelligence",
  },
  {
    num: "03",
    title: "Design coverage",
    items: ["Editable manual cases", "Positive and negative paths", "Traceable test data"],
    label: "AI test design",
  },
  {
    num: "04",
    title: "Execute with evidence",
    items: ["Cycles and modules", "Assigned testers", "Screenshots and results"],
    label: "Quality execution",
  },
  {
    num: "05",
    title: "Act on risk",
    items: ["Live Jira defect status", "Release health", "Executive visibility"],
    label: "Release confidence",
  },
];

export function FlowSteps() {
  return (
    <section id="flow" className="border-y border-border bg-bg-surface/50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">One connected quality flow</p>
        <h2 className="mt-2.5 max-w-3xl text-3xl font-bold text-text-primary leading-tight">
          Every requirement becomes a quality decision — not a document waiting for manual interpretation.
        </h2>
        <p className="mt-3 max-w-2xl text-text-secondary">
          One AI-assisted path from a Jira story or knowledge page to saved analysis, editable test
          coverage, execution evidence, and release risk.
        </p>

        <div className="mt-10 grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {steps.map((s) => (
            <Card key={s.num} hover className="relative p-5 pb-14 min-h-[300px] flex flex-col">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/15 text-amber-700 font-extrabold">
                {s.num}
              </span>
              <h3 className="mt-4 font-semibold text-text-primary leading-snug">{s.title}</h3>
              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-text-secondary">
                {s.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="absolute left-5 right-5 bottom-4 pt-3 border-t border-border text-xs font-bold text-amber-700 uppercase tracking-wide">
                {s.label}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
