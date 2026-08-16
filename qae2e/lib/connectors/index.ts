// Connector registry — re-exports the pure defs (client-safe) and reports
// placeholder status. No config/env reads: every connector is a placeholder in
// the current copy-paste-only workflow (real MCP connections are coming soon).

import { CONNECTORS, getConnector } from "./defs";
export { CONNECTORS, getConnector } from "./defs";
import type { ConnectorDef, ConnectorStatus } from "../types";

/** All connectors are placeholders right now — never configured/connected. */
export function connectorStatuses(): ConnectorStatus[] {
  return CONNECTORS.map((c) => ({
    id: c.id,
    configured: false,
    missing: ["MCP not connected"],
    hint: c.fields.find((f) => f.required)?.helpText || c.fields.find((f) => f.required)?.helpUrl || "",
  }));
}

export type { ConnectorDef };
