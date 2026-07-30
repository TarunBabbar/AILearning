import { NextRequest } from "next/server";

const globalSettings = globalThis as unknown as { __settings?: any };
if (!globalSettings.__settings) globalSettings.__settings = {};

export async function GET() {
  return Response.json(globalSettings.__settings || {});
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    globalSettings.__settings = data;
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
