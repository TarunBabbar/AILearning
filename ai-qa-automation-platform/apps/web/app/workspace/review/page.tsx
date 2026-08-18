"use client";

import { useEffect, useState } from "react";
import { api, TestCase } from "@/lib/api";

export default function ReviewPage() {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setCases(await api.listTestCases("draft"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function review(id: string, action: string) {
    await api.reviewCase(id, action);
    await load();
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold">Review Queue</h2>
      <p className="mt-1 text-sm text-slate-500">
        AI-generated test cases awaiting approval before entering the gating suite.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : cases.length === 0 ? (
          <p className="text-sm text-slate-500">No draft cases. Generate tests from the dashboard first.</p>
        ) : (
          cases.map((tc) => (
            <div key={tc.id} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{tc.title}</span>
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {tc.test_type}
                  </span>
                  <span className="ml-1 text-xs text-slate-400">derived from {tc.derived_from || "—"}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => review(tc.id, "approve")}
                    className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => review(tc.id, "reject")}
                    className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
              {tc.code && (
                <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                  {tc.code}
                </pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
