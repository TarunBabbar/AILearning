import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AGENTS } from "@/lib/agents/registry";

const stepLabels: Record<string, string> = {
  analyze: "Analyze",
  coverage: "Coverage",
  automate: "Automate",
  execute: "Execute",
  release: "Release",
};

export function AgentCards() {
  return (
    <section id="agents" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Available today</p>
        <h2 className="mt-2.5 max-w-2xl text-3xl font-bold text-text-primary leading-tight">
          AI agents that make quality work structured, visible, and actionable.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-text-secondary">
          Currently supporting copy-pasted requirements only — MCP connections (Jira, Confluence, GitHub, Zephyr,
          TestRail, Pinecone) are coming soon.
        </p>

        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map((agent) => (
            <Card key={agent.id} hover className="p-6 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="flex items-center justify-center w-11 h-11 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-700 font-black text-sm">
                  {agent.code}
                </span>
                <Badge tone="default">{stepLabels[agent.step]}</Badge>
              </div>
              <h3 className="mt-4 font-semibold text-text-primary">{agent.name}</h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed flex-1">{agent.description}</p>
              <p className="mt-3 text-xs text-text-muted">{agent.tagline}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
