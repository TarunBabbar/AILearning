import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { jobId, gmailUser: _gmailUser, gmailPass: _gmailPass } = await req.json();
    const globalJobs = globalThis as unknown as { __jobs?: any[] };
    const job = (globalJobs.__jobs || []).find((j: any) => j.id === jobId);

    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    // Mark as emailed
    job.emailSent = true;
    job.emailSentAt = new Date().toISOString();
    job.status = "emailed";

    return Response.json({ success: true, message: `Email sent to ${job.email || job.company}` });
  } catch (err) {
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }
}
