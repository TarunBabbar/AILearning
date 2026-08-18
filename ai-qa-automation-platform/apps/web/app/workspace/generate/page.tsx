"use client";

import { useEffect, useState } from "react";
import { api, Requirement } from "@/lib/api";

export default function GeneratePage() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setRequirements(await api.listRequirements());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addRequirement(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createRequirement({
        source_key: key,
        title,
        acceptance_criteria: criteria.split("\n").filter(Boolean),
        risk_tier: "medium",
      });
      setKey("");
      setTitle("");
      setCriteria("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function generate() {
    setGenerating(true);
    setError("");
    setResult("");
    try {
      const r = await api.generateTests(requirements.map((x) => x.id));
      setResult(`Generated ${r.cases_drafted} draft cases from ${r.requirements_covered} requirements. Review them in the Review Queue.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Generate Tests</h2>
      <p className="mt-1 text-sm text-slate-500">
        Add Jira stories (or paste from your board) — the agent pipeline drafts test cases.
      </p>

      <form onSubmit={addRequirement} className="mt-6 flex max-w-lg flex-col gap-3 rounded-xl border bg-white p-6 shadow-sm">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Jira key (e.g. QA-101)"
          className="rounded border px-3 py-2"
          required
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Story title"
          className="rounded border px-3 py-2"
          required
        />
        <textarea
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder="Acceptance criteria (one per line)"
          rows={3}
          className="rounded border px-3 py-2"
        />
        <button className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-800">
          Add requirement
        </button>
      </form>

      <div className="mt-6 max-w-lg">
        <h3 className="font-semibold">Requirements ({requirements.length})</h3>
        <ul className="mt-2 space-y-2">
          {requirements.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm">
              <span>
                <span className="font-mono text-slate-500">{r.source_key}</span>
                <span className="ml-2">{r.title}</span>
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{r.risk_tier}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={generate}
          disabled={generating || requirements.length === 0}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate test cases"}
        </button>
        {result && <p className="mt-3 text-sm text-green-700">{result}</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
