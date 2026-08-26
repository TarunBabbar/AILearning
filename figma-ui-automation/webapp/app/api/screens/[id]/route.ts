import { NextResponse } from 'next/server';
import { getScreen, listRuns, listApprovals } from '@/lib/store';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const screen = getScreen(id);
  if (!screen) return NextResponse.json({ error: 'screen not found' }, { status: 404 });
  return NextResponse.json({ screen, runs: listRuns(id), approvals: listApprovals(id) });
}
