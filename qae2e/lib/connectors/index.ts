// Connector registry — re-exports the pure defs (client-safe) and adds
// config-dependent status logic (server-only; pulls in lib/config → fs).

import { CONNECTORS, getConnector } from "./defs";
export { CONNECTORS, getConnector } from "./defs";
import type { ConnectorDef, ConnectorId, ConnectorStatus } from "../types";
import { getConfig } from "../config";

// Map env vars per connector so the UI can report configured/missing status.
const ENV_KEYS: Record<ConnectorId, string[]> = {
  jira: ["JIRA_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
  confluence: ["CONFLUENCE_URL", "CONFLUENCE_EMAIL", "CONFLUENCE_API_TOKEN"],
  figma: ["FIGMA_TOKEN"],
  github: ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO"],
  zephyr: ["ZEPHYR_BASE_URL", "ZEPHYR_TOKEN", "ZEPHYR_PROJECT_KEY"],
  testrail: ["TESTRAIL_URL", "TESTRAIL_USER", "TESTRAIL_API_KEY"],
};

export function connectorStatuses(): ConnectorStatus[] {
  const cfg = getConfig();
  return CONNECTORS.map((c) => {
    const keys = ENV_KEYS[c.id];
    const missing = keys
      .filter((k) => !String(cfg[k.toLowerCase() as keyof typeof cfg] || "").trim())
      .map((k) => k.replace(/_/g, " ").toLowerCase());
    const configured = missing.length === 0;
    return {
      id: c.id,
      configured,
      missing,
      hint: c.fields.find((f) => f.required)?.description || "",
    };
  });
}

export type { ConnectorDef };
