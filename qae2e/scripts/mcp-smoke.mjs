// Sessionful MCP client smoke test against the Streamable HTTP endpoint.
const BASE = "http://localhost:3001/api/mcp/sse";
let sessionId = null;

function headers() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": "2025-11-25",
    ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
  };
}

async function post(msg) {
  const r = await fetch(BASE, { method: "POST", headers: headers(), body: JSON.stringify(msg) });
  const sid = r.headers.get("Mcp-Session-Id");
  if (sid) sessionId = sid;
  const t = await r.text();
  const lines = t.split("\n").filter((l) => l.startsWith("data: "));
  if (!lines.length) {
    // JSON error body
    try { return JSON.parse(t); } catch { return { raw: t }; }
  }
  return JSON.parse(lines[lines.length - 1].slice(6));
}

async function main() {
  const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "smoke", version: "1.0" } } });
  console.log("initialize →", init.result?.serverInfo?.name, "session:", sessionId || "none");

  const tools = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const names = tools.result?.tools?.map((t) => t.name) || [];
  console.log("tools →", names.join(", ") || JSON.stringify(tools).slice(0, 200));

  const call = await post({
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "requirement_save", arguments: { title: "Smoke test req", source: "manual", content: "As a user I want to log in with email and password." } },
  });
  const text = call.result?.content?.[0]?.text || JSON.stringify(call);
  console.log("requirement_save →", text.slice(0, 160));
}

main().catch((e) => console.log("ERR", e.message));
