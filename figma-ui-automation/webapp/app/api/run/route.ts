import { NextResponse } from 'next/server';
import { startRun, type RunRequest } from '@/lib/pipeline-runner';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<RunRequest>;
  const screenId = body.screenId?.trim();
  if (!screenId) return NextResponse.json({ error: 'screenId is required' }, { status: 400 });

  if (body.kind === 'agent') {
    const allowed = ['design', 'inspect', 'validate', 'testgen', 'codegen', 'eval'];
    if (!body.agent || !allowed.includes(body.agent)) {
      return NextResponse.json({ error: `agent must be one of ${allowed.join(', ')}` }, { status: 400 });
    }
  } else if (body.kind === 'pipeline' && body.pipeline !== 'a' && body.pipeline !== 'b') {
    return NextResponse.json({ error: 'pipeline must be "a" or "b"' }, { status: 400 });
  }

  const run = startRun({
    kind: body.kind ?? 'pipeline',
    pipeline: body.pipeline,
    agent: body.agent,
    screenId,
    sample: Boolean(body.sample),
    skipEvalGate: Boolean(body.skipEvalGate),
  });

  return NextResponse.json({ runId: run.id, streamUrl: `/api/run/stream?runId=${run.id}` });
}
