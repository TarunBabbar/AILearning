import { NextResponse } from 'next/server';
import { listTestCaseFiles } from '@/lib/store';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const screen = url.searchParams.get('screen');
  const files = listTestCaseFiles();
  if (screen) return NextResponse.json(files.find((f) => f.screenId === screen) ?? null);
  return NextResponse.json(files);
}
