// Connector definitions — the source/external tools QAE2E can connect to.
// Each connector declares what credentials it needs (fields) and a human
// description, so the UI can prompt for exactly what is required.
// Pure data module — safe to import from client components (no Node deps).

import type { ConnectorDef, ConnectorId } from "../types";

export const CONNECTORS: ConnectorDef[] = [
  {
    id: "jira",
    name: "Jira",
    description: "Fetch a requirement (issue) by its Jira ID, e.g. QA-123.",
    icon: "J",
    fields: [
      { key: "url", label: "Jira base URL", type: "url", required: true, placeholder: "https://your-domain.atlassian.net", description: "Your Jira Cloud instance URL." },
      { key: "email", label: "Email", type: "email", required: true, placeholder: "you@company.com", description: "Atlassian account email." },
      { key: "apiToken", label: "API token", type: "password", required: true, placeholder: "", description: "Create at https://id.atlassian.com/manage-profile/security/api-tokens" },
    ],
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Fetch a document/page by its Confluence page ID.",
    icon: "C",
    fields: [
      { key: "url", label: "Confluence base URL", type: "url", required: true, placeholder: "https://your-domain.atlassian.net/wiki", description: "Your Confluence instance URL (include /wiki)." },
      { key: "email", label: "Email", type: "email", required: true, placeholder: "you@company.com", description: "Atlassian account email." },
      { key: "apiToken", label: "API token", type: "password", required: true, placeholder: "", description: "Same token as Jira Cloud." },
    ],
  },
  {
    id: "figma",
    name: "Figma",
    description: "Pull a design/frame from Figma and extract requirement text from it.",
    icon: "F",
    fields: [
      { key: "token", label: "Figma access token", type: "password", required: true, placeholder: "", description: "Personal access token — https://www.figma.com/developers/api#access-tokens" },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Read an existing automation repo, create a branch, and push generated test code.",
    icon: "G",
    fields: [
      { key: "token", label: "GitHub token (PAT)", type: "password", required: true, placeholder: "", description: "Fine-grained PAT with contents:read/write and pull_requests:write." },
      { key: "owner", label: "Repo owner", type: "text", required: true, placeholder: "your-org-or-user", description: "Owner of the automation repo." },
      { key: "repo", label: "Repo name", type: "text", required: true, placeholder: "my-test-automation", description: "The automation repository." },
      { key: "branch", label: "Base branch", type: "text", required: false, placeholder: "main", description: "Branch to create the new branch from." },
    ],
  },
  {
    id: "zephyr",
    name: "Zephyr Scale",
    description: "Read existing test cases and publish new ones to Zephyr Scale (Jira plugin).",
    icon: "Z",
    fields: [
      { key: "baseUrl", label: "Zephyr base URL", type: "url", required: true, placeholder: "https://api.zephyrscale.smartbear.com/v2", description: "Zephyr Scale Cloud API base URL." },
      { key: "token", label: "API token", type: "password", required: true, placeholder: "", description: "Zephyr Scale API token." },
      { key: "projectKey", label: "Project key", type: "text", required: true, placeholder: "PRJ", description: "The project key test cases belong to." },
    ],
  },
  {
    id: "testrail",
    name: "TestRail",
    description: "Read existing test cases and publish new ones to TestRail.",
    icon: "T",
    fields: [
      { key: "url", label: "TestRail URL", type: "url", required: true, placeholder: "https://your-instance.testrail.io", description: "Your TestRail instance." },
      { key: "user", label: "Username / email", type: "email", required: true, placeholder: "you@company.com", description: "TestRail account email." },
      { key: "apiKey", label: "API key", type: "password", required: true, placeholder: "", description: "Your user → Settings → API Keys." },
    ],
  },
];

export function getConnector(id: ConnectorId): ConnectorDef | undefined {
  return CONNECTORS.find((c) => c.id === id);
}
