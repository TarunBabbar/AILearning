import type { Analysis, Evaluation } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FileText } from "lucide-react";
import { EvaluationCard } from "@/components/workspace/EvaluationCard";

export function AnalysisView({ analysis, evaluation }: { analysis: Analysis | null; evaluation?: Evaluation | null }) {
  if (!analysis) return null;
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={16} className="text-amber-600" />
        <h3 className="font-semibold text-text-primary">Requirement Intelligence</h3>
        <span className="text-xs text-text-muted ml-auto font-mono">{analysis.id.slice(0, 8)}</span>
      </div>

      {evaluation && (
        <div className="mb-4">
          <EvaluationCard
            stageLabel="Analyze"
            precision={evaluation.precision}
            accuracy={evaluation.accuracy}
            rationale={evaluation.rationale}
            overall={evaluation.overall}
            improvements={evaluation.improvements}
            verdict={evaluation.verdict}
            metrics={evaluation.metrics}
            perItem={evaluation.perItem}
          />
        </div>
      )}

      <Section title="Executive summary">
        <p className="text-sm text-text-secondary leading-relaxed">{analysis.summary}</p>
      </Section>

      <Section title={`Business rules (${analysis.businessRules.length})`}>
        <Bullets items={analysis.businessRules} />
      </Section>

      <Section title={`Acceptance criteria (${analysis.acceptanceCriteria.length})`}>
        <Bullets items={analysis.acceptanceCriteria} />
      </Section>

      <Section title={`Risks (${analysis.risks.length})`}>
        <ul className="space-y-1.5">
          {analysis.risks.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
              <Badge tone={r.severity === "high" ? "red" : r.severity === "medium" ? "amber" : "green"} className="mt-0.5 shrink-0 capitalize">
                {r.severity}
              </Badge>
              <span>{r.risk}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Edge cases (${analysis.edgeCases.length})`}>
        <Bullets items={analysis.edgeCases} />
      </Section>

      <Section title={`Test data (${analysis.testData.length})`}>
        <Bullets items={analysis.testData} />
      </Section>

      {analysis.missingInfo.length > 0 && (
        <Section title="Missing information">
          <Bullets items={analysis.missingInfo} tone="amber" />
        </Section>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-text-muted mb-2">{title}</p>
      {children}
    </div>
  );
}

type BulletItem = string | Record<string, unknown>;

function formatItem(item: BulletItem): string {
  if (typeof item === "string") return item;
  return Object.entries(item)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ");
}

function Bullets({ items, tone = "default" }: { items: BulletItem[]; tone?: "default" | "amber" }) {
  if (!items.length) return <p className="text-sm text-text-muted">—</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${tone === "amber" ? "bg-amber-500" : "bg-amber-500/70"}`} />
          {formatItem(item)}
        </li>
      ))}
    </ul>
  );
}
