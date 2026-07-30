import { NextRequest } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const globalProjects = globalThis as unknown as { __projects?: any[] };
    if (globalProjects.__projects) {
      globalProjects.__projects = globalProjects.__projects.filter((p: any) => p.id !== id);
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
