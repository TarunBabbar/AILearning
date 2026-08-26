import { NextResponse } from 'next/server';
import { listGeneratedSpecs } from '@/lib/store';

export async function GET() {
  return NextResponse.json({ specs: listGeneratedSpecs() });
}
