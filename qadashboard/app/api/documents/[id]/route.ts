import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const globalDocs = globalThis as unknown as { __docs?: any[] };
    if (globalDocs.__docs) {
      globalDocs.__docs = globalDocs.__docs.filter((d: any) => d.id !== id);
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
