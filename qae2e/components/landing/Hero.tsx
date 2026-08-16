import { Button } from "@/components/ui/Button";
import { ArrowRight, CircleDot, Workflow, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";

const metrics = [
  { label: "Connect", value: "Jira, Confluence and more" },
  { label: "Collaborate", value: "specialist AI agents" },
  { label: "Prove", value: "quality with evidence" },
];

export async function Hero() {
  const user = await getSessionUser();
  const href = user ? "/workspaces" : "/login";
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-10 grid lg:grid-cols-[0.78fr_1fr] gap-10 items-center">
      <div className="rise-in">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/8 text-amber-700 text-xs font-bold uppercase tracking-[0.12em]">
          AI Quality Engineering Platform
        </div>
        <h1 className="mt-5 text-[clamp(1.6rem,2.6vw,2.5rem)] leading-[1.2] font-bold text-text-primary">
          AI-Powered Quality Engineering.{" "}
          <span className="gradient-text">From Requirement to Release Confidence.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-text-secondary leading-relaxed">
          The agentic QA workspace that turns connected requirements into testable quality
          intelligence — manual and automated coverage, execution evidence, defects, and release
          insight. Six specialist AI agents, one connected quality record.
        </p>
        <div className="mt-8 flex gap-3 flex-wrap">
          <Button href={href}>
            {user ? "My workspaces" : "Get started"} <ArrowRight size={16} />
          </Button>
          <Button href="/#flow" variant="secondary">
            Explore the platform
          </Button>
        </div>

        <div className="mt-9 grid grid-cols-3 gap-3 max-w-lg">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-border bg-bg-surface p-4">
              <p className="text-lg font-bold text-text-primary">{m.label}</p>
              <p className="mt-1 text-xs text-text-muted leading-snug">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rise-in hidden lg:block">
        <div className="rounded-xl border border-border overflow-hidden bg-bg-surface card-shadow-lg">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-hover/50">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/30" />
            <span className="ml-2 text-xs text-text-muted font-mono">qae2e · pipeline</span>
          </div>
          <div className="p-6 space-y-3">
            {[
              { icon: CircleDot, label: "Paste", text: "Requirement pasted — SauceDemo login flow" },
              { icon: Workflow, label: "Analyze", text: "Requirement Intelligence Agent → business rules, AC, risks" },
              { icon: Workflow, label: "Coverage", text: "Manual Test Case Agent → editable test cases" },
              { icon: Workflow, label: "Execute", text: "Playwright suite → 15 passed / 0 failed in Docker" },
              { icon: ShieldCheck, label: "Release", text: "AI judge → 86% confidence, low risk" },
            ].map((row, i) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-center gap-3 rounded-lg border border-border bg-bg-page px-3.5 py-2.5">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-md ${i === 4 ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                    <Icon size={13} />
                  </span>
                  <span className="text-xs font-semibold text-text-primary w-16">{row.label}</span>
                  <span className="text-xs text-text-secondary">{row.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
