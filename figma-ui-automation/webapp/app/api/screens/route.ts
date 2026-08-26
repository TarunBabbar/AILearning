import { NextResponse } from 'next/server';
import { listScreens } from '@/lib/store';

export async function GET() {
  return NextResponse.json({ screens: listScreens() });
}
