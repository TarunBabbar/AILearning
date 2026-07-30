import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("resume") as File | null;
    if (!file) return Response.json({ error: "No file" }, { status: 400 });

    const text = await file.text();
    return Response.json({ filename: file.name, size: file.size });
  } catch (err) {
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ resume: null });
}
