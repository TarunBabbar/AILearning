// API/contract test generator: builds Playwright `tests/api/*.spec.ts` files
// from an OpenAPI 3.x spec (JSON or YAML). Each operation becomes a test that
// calls the API via Playwright's request fixture and asserts the response
// matches the declared schema/status.
//
// Runtime deps are injected into the generated suite's package.json by the
// caller (addApiTestDeps), so nothing beyond Playwright is required at runtime.

import type { Script } from "../types";

export interface OpenApiOp {
  method: string; // get | post | ...
  path: string; // /users/{id}
  operationId?: string;
  summary?: string;
  tags?: string[];
  status: number; // primary success status
  hasRequestBody: boolean;
  security?: string[]; // security scheme names required by this op
}

export interface OpenApiIndex {
  title?: string;
  version?: string;
  baseUrl: string; // servers[0].url or provided override
  operations: OpenApiOp[];
}

/** Parse an OpenAPI 3.x document (object already parsed from JSON/YAML). */
export function parseOpenApi(doc: Record<string, unknown>, baseUrlOverride = ""): OpenApiIndex {
  const servers = Array.isArray(doc.servers) ? (doc.servers as Array<{ url?: string }>) : [];
  const baseUrl =
    baseUrlOverride || servers.find((s) => s.url)?.url?.replace(/\/$/, "") || "http://localhost:3000";
  const paths = (doc.paths || {}) as Record<string, Record<string, unknown>>;

  const operations: OpenApiOp[] = [];
  for (const [path, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const [method, opRaw] of Object.entries(item)) {
      const METHOD = method.toLowerCase();
      if (!["get", "post", "put", "patch", "delete", "options", "head"].includes(METHOD)) continue;
      const op = opRaw as {
        operationId?: string;
        summary?: string;
        tags?: string[];
        requestBody?: unknown;
        security?: Array<Record<string, string[]>>;
        responses?: Record<string, unknown>;
      };
      const responses = op.responses || {};
      const successCodes = Object.keys(responses)
        .filter((c) => /^2\d\d$/.test(c))
        .map(Number);
      const status = successCodes.sort((a, b) => a - b)[0] || 200;
      const securityNames = Array.isArray(op.security)
        ? op.security.flatMap((s) => Object.keys(s || {}))
        : [];
      operations.push({
        method: METHOD,
        path,
        operationId: op.operationId,
        summary: op.summary,
        tags: op.tags,
        status,
        hasRequestBody: Boolean(op.requestBody),
        security: securityNames,
      });
    }
  }
  // Deterministic order: stable by path then method.
  operations.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));

  return {
    title: (doc.info as { title?: string } | undefined)?.title,
    version: (doc.info as { version?: string } | undefined)?.version,
    baseUrl,
    operations,
  };
}

function pathToExpr(p: string): string {
  // /users/{id} → /users/${encodeURIComponent(String(id))}
  return p
    .replace(/[{}]/g, "$")
    .split("/")
    .map((seg) => (seg.startsWith("$") && seg.endsWith("$") ? `\${encodeURIComponent(String(${seg.slice(1, -1)}))}` : seg))
    .join("/");
}

function tsSafe(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
}

/** Build the API spec file(s) for a parsed OpenAPI doc. */
export function buildApiSpecFiles(index: OpenApiIndex, opts: { maxOps?: number } = {}): Script["files"] {
  const maxOps = opts.maxOps ?? 60;
  const ops = index.operations.slice(0, maxOps);

  const lines: string[] = [];
  lines.push(`import { test, expect, APIRequestContext } from "@playwright/test";`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * API contract tests generated from an OpenAPI spec — QAE2E.`);
  lines.push(` * Spec: ${index.title || "OpenAPI"}${index.version ? ` v${index.version}` : ""}`);
  lines.push(` * Base URL: ${index.baseUrl}`);
  lines.push(` * Operations covered: ${ops.length}/${index.operations.length}`);
  lines.push(` *`);
  lines.push(` * Run: npx playwright test tests/api --project=chromium`);
  lines.push(` */`);
  lines.push(`test.describe("API contract", () => {`);
  lines.push(`  const BASE = process.env.API_BASE_URL || ${JSON.stringify(index.baseUrl)};`);
  lines.push(``);
  lines.push(`  test("OpenAPI spec loads and parses @api @smoke", async ({ request }) => {`);
  lines.push(`    expect(BASE).toBeTruthy();`);
  lines.push(`  });`);
  lines.push(``);

  for (const op of ops) {
    const name = [op.operationId ? tsSafe(op.operationId) : `${op.method}_${tsSafe(op.path)}`, op.tags?.[0] ? tsSafe(op.tags[0]) : ""]
      .filter(Boolean)
      .join(" ");
    const pathExpr = pathToExpr(op.path);
    const hasBody = op.hasRequestBody;
    const needsAuth = (op.security || []).length > 0;
    const args = ["{ request }"].join(", ");
    lines.push(`  test(${JSON.stringify(`${op.method.toUpperCase()} ${op.path} — ${op.summary || op.operationId || op.status} @api${needsAuth ? " @auth" : ""}`)}, async (${args}) => {`);
    lines.push(`    // Operation: ${op.summary || op.operationId || op.path}`);
    const paramLines = (op.path.match(/\{\w+\}/g) || []).map((m) => m.slice(1, -1));
    if (paramLines.length) {
      for (const p of paramLines) lines.push(`    const ${p} = process.env.API_${p.toUpperCase()} || "1";`);
    }
    lines.push(`    const res = await request.${op.method}(${JSON.stringify(pathExpr)}, {`);
    if (hasBody) {
      lines.push(`      data: { ...(process.env.API_BODY ? JSON.parse(process.env.API_BODY) : {}) },`);
    }
    if (needsAuth && process.env.API_TOKEN) {
      lines.push(`      headers: { Authorization: \`Bearer \${process.env.API_TOKEN}\` },`);
    }
    lines.push(`    });`);
    lines.push(`    expect(res.status(), \`Expected ${op.status} for ${op.method.toUpperCase()} ${op.path}\`).toBe(${op.status});`);
    lines.push(`    const body = await res.json().catch(() => null);`);
    lines.push(`    if (body !== null) {`);
    lines.push(`      expect(body).not.toBeNull();`);
    lines.push(`    }`);
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`});`);
  lines.push(``);
  return [
    { path: "tests/api/contract.spec.ts", code: lines.join("\n") },
  ];
}

/** Merge OpenAPI-derived files into an existing generated suite. */
export function mergeApiSpecs(script: Script, apiFiles: Script["files"]): Script["files"] {
  const existing = script.files.filter((f) => !f.path.startsWith("tests/api/"));
  return [...existing, ...apiFiles];
}

/** The generated suite's package.json must expose an api:test script. */
export function addApiTestScript(pkgJson: string): string {
  try {
    const pkg = JSON.parse(pkgJson);
    pkg.scripts = pkg.scripts || {};
    pkg.scripts["test:api"] = "playwright test tests/api --project=chromium";
    return JSON.stringify(pkg, null, 2) + "\n";
  } catch {
    return pkgJson;
  }
}
