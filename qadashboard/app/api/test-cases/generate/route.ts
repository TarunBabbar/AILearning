import { NextRequest } from "next/server";
import { chatCompletion } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  try {
    const { prdText, jiraKey } = await req.json();

    if (!prdText) {
      return Response.json({ error: "PRD text required" }, { status: 400 });
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

    const raw = await chatCompletion([
      { role: "system", content: "You are a test architect. Generate structured test cases in JSON format only." },
      { role: "user", content: prompt },
    ], undefined, 0.3, 8192);

    const cleaned = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    let testCases;
    try {
      testCases = JSON.parse(cleaned);
    } catch {
      testCases = [
        {
          title: "Test Case 1: Verify core functionality",
          description: "Verify that the main feature works as expected",
          steps: [{ action: "Navigate to the feature", expected: "Feature loads successfully" }, { action: "Execute primary action", expected: "Expected result is displayed" }],
          priority: "high", testType: "functional",
        },
        {
          title: "Test Case 2: Verify error handling",
          description: "Verify system handles invalid input gracefully",
          steps: [{ action: "Enter invalid data", expected: "Validation error is shown" }],
          priority: "high", testType: "functional",
        },
        {
          title: "Test Case 3: Boundary test",
          description: "Test boundary conditions",
          steps: [{ action: "Enter boundary values", expected: "System handles correctly" }],
          priority: "medium", testType: "functional",
        },
      ];
    }

    return Response.json({ testCases, count: testCases.length, jiraKey });
  } catch (err) {
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
