// Connector registry — schema-driven connector definitions.
//
// Each connector is declared once as data (id, authType, fields, testEndpoint,
// docsUrl) and the Settings → Integrations UI is rendered generically from it.
// Adding a new connector = adding one registry entry, no new form component.
// Pure data module — safe to import from client components (no Node deps).
//
// Per-connector setup copy (newreq.md §2.5) lives in field helpText/helpUrl and
// connector docsUrl, so the UI can always point the user at the provider's
// "generate a token" page.

import type { ConnectorDef, ConnectorId } from "../types";

export const CONNECTOR_REGISTRY: ConnectorDef[] = [
  {
    id: "jira",
    name: "Jira",
    authType: "basic_auth",
    testEndpoint: "GET /rest/api/3/myself",
    docsUrl: "https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/",
    fields: [
      {
        key: "url",
        label: "Jira base URL",
        type: "url",
        required: true,
        helpText: "Your Jira Cloud instance URL, e.g. https://your-domain.atlassian.net",
      },
      {
        key: "email",
        label: "Email",
        type: "text",
        required: true,
        helpText: "Atlassian account email — used as the Basic Auth username.",
      },
      {
        key: "apiToken",
        label: "API token",
        type: "password",
        required: true,
        helpText: "Generate an API token from your Atlassian account → Security → API tokens. Use your account email as the username.",
        helpUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
      },
    ],
  },
  {
    id: "confluence",
    name: "Confluence",
    authType: "basic_auth",
    testEndpoint: "GET /rest/api/user/current",
    docsUrl: "https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/",
    fields: [
      {
        key: "url",
        label: "Confluence base URL",
        type: "url",
        required: true,
        helpText: "Your Confluence instance URL (include /wiki), e.g. https://your-domain.atlassian.net/wiki",
      },
      {
        key: "email",
        label: "Email",
        type: "text",
        required: true,
        helpText: "Atlassian account email — same account as Jira Cloud.",
      },
      {
        key: "apiToken",
        label: "API token",
        type: "password",
        required: true,
        helpText: "Same API token as Jira Cloud — one Atlassian app covers both Jira + Confluence scopes.",
        helpUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
      },
    ],
  },
  // Temporarily hidden from the UI (kept in the registry for reference):
  // {
  //   id: "figma",
  //   name: "Figma",
  //   authType: "bearer_token",
  //   testEndpoint: "GET /v1/me",
  //   docsUrl: "https://help.figma.com/hc/en-us/articles/8084683771543-Manage-personal-access-tokens",
  //   fields: [
  //     {
  //       key: "token",
  //       label: "Personal access token",
  //       type: "password",
  //       required: true,
  //       helpText: "Generate a personal access token from Figma → Settings → Personal access tokens.",
  //       helpUrl: "https://www.figma.com/settings",
  //     },
  //   ],
  // },
  {
    id: "github",
    name: "GitHub",
    authType: "bearer_token",
    testEndpoint: "GET /user",
    docsUrl: "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
    fields: [
      {
        key: "token",
        label: "Fine-grained PAT",
        type: "password",
        required: true,
        helpText: "Create a fine-grained PAT scoped to just the repo(s) you want QAE2E to read/write. Needs contents:read/write, pull_requests:write.",
        helpUrl: "https://github.com/settings/personal-access-tokens/new",
      },
      {
        key: "owner",
        label: "Repo owner",
        type: "text",
        required: true,
        helpText: "Owner of the automation repo (user or org).",
      },
      {
        key: "repo",
        label: "Repo name",
        type: "text",
        required: true,
        helpText: "The automation repository.",
      },
      {
        key: "branch",
        label: "Base branch",
        type: "text",
        required: false,
        helpText: "Branch to create the new branch from (default: main).",
      },
    ],
  },
  {
    id: "zephyr",
    name: "Zephyr Scale",
    authType: "bearer_token",
    testEndpoint: "GET /testcases?projectKey=…&maxResults=1",
    docsUrl: "https://support.smartbear.com/zephyr-scale-cloud/docs/api/index.html",
    fields: [
      {
        key: "baseUrl",
        label: "Zephyr base URL",
        type: "url",
        required: true,
        helpText: "Zephyr Scale Cloud API base URL, e.g. https://api.zephyrscale.smartbear.com/v2",
      },
      {
        key: "token",
        label: "API token",
        type: "password",
        required: true,
        helpText: "Generate a token from your Jira profile icon → Zephyr Scale API Access Tokens. Tokens expire periodically (~3 months) — you'll need to regenerate and re-save here.",
        helpUrl: "https://support.smartbear.com/zephyr-scale-cloud/docs/api/api-tokens.html",
      },
      {
        key: "projectKey",
        label: "Project key",
        type: "text",
        required: true,
        helpText: "The project key test cases belong to.",
      },
    ],
  },
  {
    id: "testrail",
    name: "TestRail",
    authType: "basic_auth",
    testEndpoint: "GET /index.php?/api/v2/get_projects",
    docsUrl: "https://www.testrail.com/support/help/v7/api",
    fields: [
      {
        key: "url",
        label: "TestRail URL",
        type: "url",
        required: true,
        helpText: "Your TestRail instance, e.g. https://your-instance.testrail.io",
      },
      {
        key: "user",
        label: "Username / email",
        type: "text",
        required: true,
        helpText: "Your TestRail login email — entered together with the API key.",
      },
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
        helpText: "Generate an API key from My Settings → API Keys in TestRail. New keys can take up to 20 minutes to activate — a 'Test connection' failure right after saving may just be the activation delay.",
        helpUrl: "https://www.testrail.com/support/help/v7/api",
      },
    ],
  },
  {
    id: "pinecone",
    name: "Pinecone",
    authType: "api_token",
    testEndpoint: "POST {host}/describe_index_stats",
    docsUrl: "https://docs.pinecone.io/guides/get-started/quickstart",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
        helpText: "Create a free serverless index and paste its API key here.",
        helpUrl: "https://app.pinecone.io",
      },
      {
        key: "index",
        label: "Index name",
        type: "text",
        required: true,
        helpText: "The serverless index name (used for vector storage/retrieval).",
      },
      {
        key: "host",
        label: "Index host",
        type: "url",
        required: true,
        helpText: "The index host URL from the Pinecone console (used as the API endpoint).",
      },
    ],
  },
  // Temporarily hidden from the UI (OpenRouter key lives in .env / API usage tab):
  // {
  //   id: "openrouter",
  //   name: "OpenRouter",
  //   authType: "bearer_token",
  //   testEndpoint: "GET /api/v1/key",
  //   docsUrl: "https://openrouter.ai/docs/api-reference/authentication",
  //   fields: [
  //     {
  //       key: "apiKey",
  //       label: "API key",
  //       type: "password",
  //       required: true,
  //       helpText: "OpenRouter API key — drives all the agent LLM calls. Free models only (:free suffix).",
  //       helpUrl: "https://openrouter.ai/settings/keys",
  //     },
  //   ],
  // },
];

export function getConnectorDef(id: ConnectorId | string): ConnectorDef | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id);
}
