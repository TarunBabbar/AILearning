import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { chatCompletion } from "@/lib/openrouter";

type GeneratedTestCase = {
  title: string;
  description?: string;
  steps: { action: string; expected: string }[];
  priority: string;
  testType: string;
};

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const { prdText, jiraKey, projectId } = await req.json();

    if (!prdText) {
      return Response.json({ error: "PRD text required" }, { status: 400 });
    }

    // Ensure the project belongs to the user before persisting to it
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
      if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const prompt = `You are a test architect. Analyze the following PRD/requirements and generate comprehensive test cases. Return ONLY a JSON array of test case objects.

Each test case must have: title, description, steps (array of {action, expected}), priority (high/medium/low), testType (functional/regression/api/ui).

Generate at least 5 test cases covering:
- Positive scenarios (happy path)
- Negative scenarios (error handling, edge cases)
- Boundary conditions
- UI/UX validation if applicable

Requirements:
${prdText}${jiraKey ? `\nJIRA Key: ${jiraKey}` : ""}`;

    const raw = await chatCompletion(
      [
        { role: "system", content: "You are a test architect. Generate structured test cases in JSON format only." },
        { role: "user", content: prompt },
      ],
      undefined,
      0.3,
      8192
    );

    const cleaned = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    let testCases: GeneratedTestCase[] = [];
    try {
      testCases = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: "The model returned invalid JSON — try again" }, { status: 502 });
    }

    // Persist to project when provided
    if (projectId) {
      await prisma.testCase.createMany({
        data: testCases.map((tc) => ({
          projectId,
          title: tc.title || "Untitled",
          description: tc.description || null,
          steps: tc.steps || [],
          priority: tc.priority || "medium",
          testType: tc.testType || "functional",
        })),
      });
    }

    return Response.json({ testCases, count: testCases.length, jiraKey, projectId });
  } catch (err) {
    console.error("[test-cases/generate] failed:", err);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
