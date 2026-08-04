// Env config. Reads .env file live on every getConfig() call (cached by mtime),
// so editing .env takes effect WITHOUT a server restart. No secrets hardcoded.

import { readFileSync, statSync } from "fs";
import { join } from "path";

let cachedMtime = -1;
let cachedEnv: Record<string, string> = {};

function loadDotEnv(): void {
  try {
    const envPath = join(process.cwd(), ".env");
    const st = statSync(envPath);
    if (st.mtimeMs === cachedMtime) return;
    const raw = readFileSync(envPath, "utf-8");
    const parsed: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let value = m[2].trim();
      // strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      parsed[m[1]] = value;
    }
    cachedEnv = parsed;
    cachedMtime = st.mtimeMs;
  } catch {
    // no .env — fall back to process.env only
  }
}

// Resolve a value: .env file first, then process.env (deployment), then default.
function env(key: string, fallback = ""): string {
  loadDotEnv();
  return cachedEnv[key] !== undefined && cachedEnv[key] !== ""
    ? cachedEnv[key]
    : process.env[key] !== undefined && process.env[key] !== ""
      ? (process.env[key] as string)
      : fallback;
}

export function getConfig() {
  return {
    openrouterApiKey: env("OPENROUTER_API_KEY"),
    openrouterBaseUrl: env("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    llmModel: env("LLM_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free"),
    visionModel: env("VISION_MODEL", "google/gemma-4-26b-a4b-it:free"),
    dataDir: env("DATA_DIR", "data"),
    appName: env("NEXT_PUBLIC_APP_NAME", "QAE2E Agentic Quality Engineering"),

    // ---- Source connectors ----
    jiraUrl: env("JIRA_URL"),
    jiraEmail: env("JIRA_EMAIL"),
    jiraApiToken: env("JIRA_API_TOKEN"),
    jiraProjectKey: env("JIRA_PROJECT_KEY"),
    confluenceUrl: env("CONFLUENCE_URL"),
    confluenceEmail: env("CONFLUENCE_EMAIL"),
    confluenceApiToken: env("CONFLUENCE_API_TOKEN"),
    figmaToken: env("FIGMA_TOKEN"),
    githubToken: env("GITHUB_TOKEN"),
    githubOwner: env("GITHUB_OWNER"),
    githubRepo: env("GITHUB_REPO"),
    githubBranch: env("GITHUB_BRANCH", "main"),
    githubNewBranchPrefix: env("GITHUB_NEW_BRANCH_PREFIX", "qae2e"),
    githubWorkflowFile: env("GITHUB_WORKFLOW_FILE", ".github/workflows/e2e.yml"),
    zephyrBaseUrl: env("ZEPHYR_BASE_URL"),
    zephyrToken: env("ZEPHYR_TOKEN"),
    zephyrProjectKey: env("ZEPHYR_PROJECT_KEY"),
    testrailUrl: env("TESTRAIL_URL"),
    testrailUser: env("TESTRAIL_USER"),
    testrailApiKey: env("TESTRAIL_API_KEY"),
    testrailRunId: env("TESTRAIL_RUN_ID"),

    // ---- RAG / embeddings ----
    pineconeApiKey: env("PINECONE_API_KEY"),
    pineconeIndex: env("PINECONE_INDEX"),
    pineconeHost: env("PINECONE_HOST"),
    embeddingModel: env("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),

    // ---- Local execution ----
    dockerImage: env("DOCKER_IMAGE", "mcr.microsoft.com/playwright:v1.51.0-jammy"),
    // Command run inside the container (after the node/npm/playwright preflight).
    // `npm test` prefers the suite's own package.json script; falls back to the
    // pinned Playwright runner when the suite has no scripts.
    testCommand: env("TEST_COMMAND", "npm test || npx --yes playwright@1.51.0 test --project=chromium"),

    // ---- Connection test defaults ----
    testJiraIssueKey: env("TEST_JIRA_ISSUE_KEY"),
    testConfluencePageId: env("TEST_CONFLUENCE_PAGE_ID"),
    testFigmaFileKey: env("TEST_FIGMA_FILE_KEY"),
  };
}

/**
 * Config for a specific workspace: merges per-workspace connector secrets
 * (workspace_secrets table) on top of the env-based config, so connector reads
 * resolve the workspace's own credentials.
 */
export async function getWorkspaceConfig(workspaceId: string): Promise<AppConfig> {
  const base = getConfig();
  if (!workspaceId) return base;
  try {
    const { getWorkspaceSecrets } = await import("./db");
    const secrets = await getWorkspaceSecrets(workspaceId);
    return {
      ...base,
      jiraUrl: secrets.JIRA_URL || base.jiraUrl,
      jiraEmail: secrets.JIRA_EMAIL || base.jiraEmail,
      jiraApiToken: secrets.JIRA_API_TOKEN || base.jiraApiToken,
      jiraProjectKey: secrets.JIRA_PROJECT_KEY || base.jiraProjectKey,
      confluenceUrl: secrets.CONFLUENCE_URL || base.confluenceUrl,
      confluenceEmail: secrets.CONFLUENCE_EMAIL || base.confluenceEmail,
      confluenceApiToken: secrets.CONFLUENCE_API_TOKEN || base.confluenceApiToken,
      figmaToken: secrets.FIGMA_TOKEN || base.figmaToken,
      githubToken: secrets.GITHUB_TOKEN || base.githubToken,
      githubOwner: secrets.GITHUB_OWNER || base.githubOwner,
      githubRepo: secrets.GITHUB_REPO || base.githubRepo,
      githubBranch: secrets.GITHUB_BRANCH || base.githubBranch,
      zephyrBaseUrl: secrets.ZEPHYR_BASE_URL || base.zephyrBaseUrl,
      zephyrToken: secrets.ZEPHYR_TOKEN || base.zephyrToken,
      zephyrProjectKey: secrets.ZEPHYR_PROJECT_KEY || base.zephyrProjectKey,
      testrailUrl: secrets.TESTRAIL_URL || base.testrailUrl,
      testrailUser: secrets.TESTRAIL_USER || base.testrailUser,
      testrailApiKey: secrets.TESTRAIL_API_KEY || base.testrailApiKey,
      testrailRunId: secrets.TESTRAIL_RUN_ID || base.testrailRunId,
      pineconeApiKey: secrets.PINECONE_API_KEY || base.pineconeApiKey,
      pineconeIndex: secrets.PINECONE_INDEX || base.pineconeIndex,
      pineconeHost: secrets.PINECONE_HOST || base.pineconeHost,
    };
  } catch {
    return base;
  }
}

export type AppConfig = ReturnType<typeof getConfig>;
