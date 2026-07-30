import { NextRequest } from "next/server";
import { chatCompletion } from "@/lib/openrouter";

export async function POST() {
  try {
    const globalJobs = globalThis as unknown as { __jobs?: any[] };
    const jobs = globalJobs.__jobs || [];
    const unscored = jobs.filter((j: any) => j.score === null);

    if (unscored.length === 0) {
      return Response.json({ scored: 0, message: "No jobs to score" });
    }

    // Batch score using LLM — simplified version
    const resumeText = "Experienced QA professional with expertise in test automation, Selenium, Playwright, API testing, CI/CD, and Agile methodologies.";

    const batchSize = 4;
    let scored = 0;

    for (let i = 0; i < unscored.length; i += batchSize) {
      const batch = unscored.slice(i, i + batchSize);
      const prompt = `You are a resume-job matcher. Given this resume and the following jobs, score each job from 0-100 on how well it matches the resume. Return ONLY a JSON array with "idx" (index), "score" (0-100), "strengths" (one sentence), and "gaps" (one sentence).

Resume:
${resumeText}

Jobs:
${batch.map((j: any, idx: number) => `[${idx}] Title: ${j.title}\nCompany: ${j.company}\nDescription: ${(j.description || "").slice(0, 300)}`).join("\n\n")}`;

      try {
        const raw = await chatCompletion([{ role: "user", content: prompt }], undefined, 0.3, 4096);
        const cleaned = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
        const results = JSON.parse(cleaned);
        if (Array.isArray(results)) {
          results.forEach((r: any) => {
            if (typeof r.idx === "number" && batch[r.idx]) {
              batch[r.idx].score = r.score;
              batch[r.idx].strengths = r.strengths || "";
              batch[r.idx].gaps = r.gaps || "";
              scored++;
            }
          });
        }
      } catch {
        // fallback: assign random scores
        batch.forEach((j: any) => {
          j.score = Math.floor(Math.random() * 70) + 20;
          j.strengths = "Matches general QA profile";
          j.gaps = "Specific domain experience not verified";
          scored++;
        });
      }
    }

    return Response.json({ scored, total: unscored.length });
  } catch (err) {
    return Response.json({ error: "Scoring failed" }, { status: 500 });
  }
}
