import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status } = await req.json();
    const globalJobs = globalThis as unknown as { __jobs?: any[] };
    if (globalJobs.__jobs) {
      const job = globalJobs.__jobs.find((j: any) => j.id === id);
      if (job) job.status = status;
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const globalJobs = globalThis as unknown as { __jobs?: any[] };
    if (globalJobs.__jobs) {
      const job = globalJobs.__jobs.find((j: any) => j.id === id);
      if (job) job.status = "deleted";
    }
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
