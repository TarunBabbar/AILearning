/**
 * Same-origin API client — Vercel-hosted Next.js serves both UI and API,
 * so calls go to /api/v1/* with the session cookie (no JWT header needed).
 */

export interface Connection {
  id: string;
  type: string;
  status: string;
  scope_config: Record<string, unknown>;
  expires_at: string | null;
}

export interface TestCase {
  id: string;
  title: string;
  test_type: string;
  status: string;
  source: string;
  derived_from: string | null;
  priority: string;
  tags: string[];
  code: string | null;
}

export interface Requirement {
  id: string;
  source_key: string;
  title: string;
  risk_tier: string;
  source_link: string | null;
}

export interface Run {
  id: string;
  trigger: string;
  status: string;
  gate_verdict: string | null;
  created_at: string;
  passed: number;
  failed: number;
  total: number;
}

export interface MetricScore {
  metric: string;
  score: number;
  threshold: number;
  hard_gate: boolean;
  passed: boolean;
}

export interface WorkspaceSettings {
  thresholds: Record<string, number>;
  risk_tiers: Record<string, unknown>;
  gate_policy: Record<string, unknown>;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export const api = {
  // Connections
  listConnections: () => request<Connection[]>("/connections"),
  createConnection: (type: string, secret: string, scopeConfig: Record<string, unknown>) =>
    request<Connection>("/connections", {
      method: "POST",
      body: JSON.stringify({ type, secret, scope_config: scopeConfig }),
    }),
  testConnection: (id: string) =>
    request<{ ok: boolean; status: string; error?: string }>(`/connections/${id}`, { method: "POST" }),
  deleteConnection: (id: string) =>
    request<{ ok: boolean }>(`/connections/${id}`, { method: "DELETE" }),

  // Test cases
  listTestCases: (status?: string) =>
    request<TestCase[]>(`/testcases${status ? `?status=${status}` : ""}`),
  reviewCase: (id: string, action: string, code?: string) =>
    request<{ ok: boolean }>(`/testcases/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, code }),
    }),

  // Requirements + generation
  listRequirements: () => request<Requirement[]>("/requirements"),
  createRequirement: (r: Partial<Requirement> & { source_key: string; title: string; acceptance_criteria?: string[]; risk_tier?: string }) =>
    request<Requirement>("/requirements", { method: "POST", body: JSON.stringify(r) }),
  generateTests: (requirementIds?: string[]) =>
    request<{ cases_drafted: number; requirements_covered: number }>("/requirements/generate", {
      method: "POST",
      body: JSON.stringify({ requirement_ids: requirementIds, max_cases: 50 }),
    }),

  // Settings
  getSettings: (workspaceId: string) =>
    request<WorkspaceSettings>(`/workspaces/${workspaceId}/settings`),
  updateSettings: (workspaceId: string, s: Partial<WorkspaceSettings>) =>
    request<WorkspaceSettings>(`/workspaces/${workspaceId}/settings`, {
      method: "PUT",
      body: JSON.stringify(s),
    }),

  // Runs
  triggerRun: () =>
    request<Run>("/runs", { method: "POST", body: JSON.stringify({ trigger: "manual" }) }),
  listRuns: () => request<Run[]>("/runs"),
  runMetrics: (runId: string) => request<MetricScore[]>(`/runs/${runId}/metrics`),
};
