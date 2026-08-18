"use client";

import { useEffect, useState } from "react";
import { api, Connection } from "@/lib/api";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState("");
  const [type, setType] = useState("github");
  const [error, setError] = useState("");

  async function load() {
    try {
      setConnections(await api.listConnections());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createConnection(type, secret, {});
      setSecret("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function disconnect(id: string) {
    await api.deleteConnection(id);
    await load();
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Connections</h2>
      <p className="mt-1 text-sm text-slate-500">
        Connect GitHub, Jira, and your database. Credentials are encrypted at rest (KMS).
      </p>

      <form onSubmit={connect} className="mt-6 flex max-w-lg flex-col gap-3 rounded-xl border bg-white p-6 shadow-sm">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border px-3 py-2">
          <option value="github">GitHub</option>
          <option value="jira">Jira</option>
          <option value="database">Database</option>
        </select>
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={type === "database" ? "postgresql://readonly:...@host/db" : "Token / API key"}
          className="rounded border px-3 py-2"
        />
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
          Connect
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          connections.map((c) => (
            <div key={c.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize">{c.type}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    c.status === "connected" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {c.status}
                </span>
              </div>
              <button onClick={() => disconnect(c.id)} className="mt-3 text-xs text-red-600 hover:underline">
                Disconnect
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
