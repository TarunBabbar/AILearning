import { prisma } from "../db";
import { getProvider } from "../llm/client";
import { RequirementsAnalystAgent, TestPlannerAgent, TestDesignerAgent } from "../agents/phase-agents";
import type { AgentContext } from "../agents/base";

/**
 * Generation pipeline — Jira stories → draft test cases (review queue).
 * Analyst → Planner → Designer. Persists drafts + coverage links.
 */
export async function runGenerationPipeline(
  workspaceId: string,
  requirementIds?: string[],
  maxCases = 50,
): Promise<{ cases_drafted: number; requirements_covered: number; error?: string }> {
  // 1. Gather requirements
  const requirements = await prisma.requirement.findMany({
    where: {
      workspaceId,
      ...(requirementIds?.length ? { id: { in: requirementIds } } : {}),
    },
    take: 200,
  });
  if (requirements.length === 0) {
    return { cases_drafted: 0, requirements_covered: 0, error: "no requirements" };
  }

  // 2. Agent chain
  const storyData = requirements.map((r) => ({
    key: r.sourceKey,
    title: r.title,
    description: r.description,
    acceptance_criteria: r.acceptanceCriteria,
    risk_tier: r.riskTier,
  }));

  const ctx: AgentContext = { workspaceId, data: { requirements: storyData } };
  const analyst = new RequirementsAnalystAgent();
  const analystResult = await analyst.run(ctx);
  if (analystResult.status !== "success") return { cases_drafted: 0, requirements_covered: 0, error: analystResult.error };

  // Persist rubrics
  const stories = (analystResult.output.stories ?? []) as Array<Record<string, unknown>>;
  for (const story of stories) {
    const key = story.key as string;
    const req = requirements.find((r) => r.sourceKey === key);
    if (req) {
      await prisma.requirement.update({ where: { id: req.id }, data: { rubric: story.rubric as object } });
    }
  }

  const planner = new TestPlannerAgent();
  const plannerResult = await planner.run({
    workspaceId,
    data: { rubrics: analystResult.output, coverageMap: await coverageMap(workspaceId), settings: await workspaceSettings(workspaceId) },
  });
  if (plannerResult.status !== "success") return { cases_drafted: 0, requirements_covered: 0, error: plannerResult.error };

  const designer = new TestDesignerAgent();
  const designerResult = await designer.run({
    workspaceId,
    data: {
      plan: plannerResult.output,
      repoStructure: await repoStructure(workspaceId),
      existingTests: await existingTests(workspaceId),
      dbSchema: await dbSchema(workspaceId),
    },
  });
  if (designerResult.status !== "success") return { cases_drafted: 0, requirements_covered: 0, error: designerResult.error };

  // 3. Persist drafts + coverage
  const cases = (designerResult.output.cases ?? []) as Array<Record<string, unknown>>;
  let drafted = 0;
  for (const c of cases.slice(0, maxCases)) {
    const derivedFrom = (c.derived_from as string) ?? "";
    const req = requirements.find((r) => r.sourceKey === derivedFrom);
    const tc = await prisma.testCase.create({
      data: {
        workspaceId,
        requirementId: req?.id,
        title: (c.title as string) ?? "Untitled",
        testType: (c.test_type as string) ?? "api",
        status: "draft",
        source: "ai-generated",
        derivedFrom,
        code: (c.code as string) ?? null,
        tags: (c.tags as string[]) ?? [],
        priority: (c.priority as string) ?? "P2",
      },
    });
    if (req) {
      await prisma.coverageMap.create({
        data: { workspaceId, requirementId: req.id, testCaseId: tc.id },
      });
    }
    drafted++;
  }

  return { cases_drafted: drafted, requirements_covered: requirements.length };
}

async function coverageMap(workspaceId: string) {
  const count = await prisma.coverageMap.count({ where: { workspaceId } });
  return { total_links: count };
}

async function workspaceSettings(workspaceId: string) {
  const s = await prisma.workspaceSettings.findUnique({ where: { workspaceId } });
  return { thresholds: s?.thresholds ?? {}, risk_tiers: s?.riskTiers ?? {}, gate_policy: s?.gatePolicy ?? {} };
}

async function repoStructure(workspaceId: string): Promise<string[]> {
  const conn = await prisma.connection.findFirst({ where: { workspaceId, type: "github" } });
  const repos = (conn?.scopeConfig as { repos?: string[] } | null)?.repos ?? [];
  return repos;
}

async function existingTests(workspaceId: string) {
  const rows = await prisma.testCase.findMany({
    where: { workspaceId, source: "user-provided" },
    take: 100,
    select: { title: true, testType: true, tags: true },
  });
  return rows;
}

async function dbSchema(workspaceId: string) {
  const conn = await prisma.connection.findFirst({ where: { workspaceId, type: "database" } });
  return (conn?.scopeConfig as object | null) ?? {};
}

/** Sanity check that the LLM provider is reachable (used by /connections/test). */
export async function testLLM(): Promise<{ ok: boolean; error?: string }> {
  try {
    const provider = getProvider();
    await provider.complete({ prompt: "Reply with the single word: ok" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
