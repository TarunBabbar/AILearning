import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '@/lib/paths';
import { load as loadYaml, dump } from 'js-yaml';

interface CaseDoc {
  id: string;
  title: string;
  feature: string;
  scenario: string;
  priority: string;
  source: string;
  review?: string;
  reviewNote?: string;
  steps: Array<{ action: string; target?: string; value?: string }>;
  expected: string;
}

interface TestDoc {
  schemaVersion: number;
  screenId: string;
  designVersion: string;
  generatedAt: string;
  provider: string;
  cases: CaseDoc[];
}

function getFile(screenId: string): string {
  return path.join(paths.testCases, `${screenId}.tests.yaml`);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { screenId?: string; caseId?: string; decision?: string; all?: boolean; note?: string };

  const screenId = body.screenId?.trim();
  if (!screenId) return NextResponse.json({ error: 'screenId required' }, { status: 400 });

  const p = getFile(screenId);
  if (!fs.existsSync(p)) return NextResponse.json({ error: `no test cases for "${screenId}"` }, { status: 404 });

  const doc = loadYaml(fs.readFileSync(p, 'utf-8')) as TestDoc;

  if (body.all) {
    for (const c of doc.cases) c.review = body.decision ?? 'approved';
  } else {
    const target = doc.cases.find((c) => c.id === body.caseId);
    if (!target) return NextResponse.json({ error: `case "${body.caseId}" not found` }, { status: 404 });
    target.review = body.decision ?? 'approved';
    if (body.note) target.reviewNote = body.note;
  }

  fs.writeFileSync(p, dump(doc, { noRefs: true, lineWidth: -1, quotingType: "'" }), 'utf-8');

  return NextResponse.json({
    ok: true,
    summary: {
      screenId: doc.screenId,
      total: doc.cases.length,
      approved: doc.cases.filter((c) => c.review === 'approved').length,
      rejected: doc.cases.filter((c) => c.review === 'rejected').length,
      pending: doc.cases.filter((c) => !c.review).length,
    },
  });
}
