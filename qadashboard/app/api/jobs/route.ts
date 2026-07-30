import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";

// In-memory store (replaced by DB when Neon is connected)
const globalJobs = globalThis as unknown as { __jobs?: any[] };
if (!globalJobs.__jobs) globalJobs.__jobs = [];

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("jobs") as File[];

    // Mock extraction — in production calls LLM to parse jobs from PDFs
    const extractJob = (text: string, filename: string) => {
      // Simple extraction from raw text — real version uses LLM
      const lines = text.split("\n").filter((l) => l.trim());
      const jobs: any[] = [];
      let current: any = null;

      for (const line of lines) {
        const l = line.trim();
        if (l.toLowerCase().includes("title:") || l.toLowerCase().includes("position:")) {
          if (current) jobs.push(current);
          current = { id: uuid(), title: l.split(":")[1]?.trim() || "Unknown Position", company: "Unknown Company", email: "", location: "", experience: "", description: l, status: "new", score: null, strengths: "", gaps: "", emailSent: false, createdAt: new Date().toISOString() };
        } else if (current) {
          if (l.toLowerCase().includes("company:")) current.company = l.split(":")[1]?.trim() || "Unknown";
          else if (l.toLowerCase().includes("email:")) current.email = l.split(":")[1]?.trim() || "";
          else if (l.toLowerCase().includes("location:")) current.location = l.split(":")[1]?.trim() || "";
          else if (l.toLowerCase().includes("experience:") || l.toLowerCase().includes("exp:")) current.experience = l.split(":")[1]?.trim() || "";
          else current.description += "\n" + l;
        }
      }
      if (current) jobs.push(current);
      return jobs;
    };

    let extracted: any[] = [];
    for (const file of files) {
      const text = await file.text();
      const jobs = extractJob(text, file.name);
      extracted = extracted.concat(jobs);
    }

    globalJobs.__jobs = [...(globalJobs.__jobs || []), ...extracted];
    return Response.json({ count: extracted.length, jobs: extracted });
  } catch (err) {
    return Response.json({ error: "Failed to extract jobs" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  let jobs = globalJobs.__jobs || [];
  if (status) jobs = jobs.filter((j: any) => j.status === status);
  return Response.json({ jobs, total: jobs.length });
}
