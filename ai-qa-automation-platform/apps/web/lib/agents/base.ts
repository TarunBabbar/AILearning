import { completeJson } from "../llm/json";

/**
 * Agent framework — shared contract for all STLC agents.
 * Every agent: name, description, output schema, buildPrompt(ctx) → structured JSON.
 */
export interface AgentContext {
  workspaceId: string;
  runId?: string;
  data: Record<string, unknown>;
}

export interface AgentResult {
  agent: string;
  status: "success" | "retry" | "escalate";
  output: Record<string, unknown>;
  error?: string;
}

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;
  abstract outputSchema: string;

  protected abstract buildPrompt(ctx: AgentContext): string;

  systemPrompt(): string {
    return [
      `You are ${this.name}.`,
      this.description,
      "Always respond with valid JSON matching:",
      this.outputSchema,
    ].join("\n");
  }

  async run(ctx: AgentContext): Promise<AgentResult> {
    try {
      const output = await completeJson({
        prompt: this.buildPrompt(ctx),
        system: this.systemPrompt(),
      });
      return { agent: this.name, status: "success", output };
    } catch (e) {
      return { agent: this.name, status: "retry", output: {}, error: (e as Error).message };
    }
  }
}
