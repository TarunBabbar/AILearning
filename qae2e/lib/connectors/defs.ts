// Back-compat shim: the schema-driven registry (lib/connectors/registry.ts) is
// now the single source of connector definitions. This module re-exports it so
// existing consumers (lib/connectors/index.ts, legacy /api/connectors) keep
// working unchanged.

export { CONNECTOR_REGISTRY as CONNECTORS, getConnectorDef as getConnector } from "./registry";
export type { ConnectorDef } from "../types";
