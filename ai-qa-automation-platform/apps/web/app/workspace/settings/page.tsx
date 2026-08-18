"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.workspaceId) return;
    api
      .getSettings(session.workspaceId)
      .then((s) => setThresholds(s.thresholds || {}))
      .catch((e) => setError((e as Error).message));
  }, [session?.workspaceId]);

  async function save() {
    if (!session?.workspaceId) return;
    setSaving(true);
    setError("");
    try {
      await api.updateSettings(session.workspaceId, { thresholds });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const metricFields: Array<[string, string]> = [
    ["answer_relevancy", "Answer Relevancy (soft)"],
    ["groundedness", "Groundedness (hard)"],
    ["completeness", "Completeness"],
    ["correctness", "Correctness (hard on high-risk)"],
    ["tool_sequence_accuracy", "Tool Sequence Accuracy (hard)"],
  ];

  return (
    <div>
      <h2 className="text-2xl font-semibold">Settings</h2>
      <p className="mt-1 text-sm text-slate-500">
        DeepEval metric thresholds — hard-gate failures block releases.
      </p>

      <div className="mt-6 max-w-md space-y-3 rounded-xl border bg-white p-6 shadow-sm">
        {metricFields.map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-4 text-sm">
            <span>{label}</span>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={thresholds[key] ?? 0.8}
              onChange={(e) => setThresholds({ ...thresholds, [key]: parseFloat(e.target.value) })}
              className="w-24 rounded border px-2 py-1 text-right"
            />
          </label>
        ))}
        <button
          onClick={save}
          disabled={saving}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save thresholds"}
        </button>
        {saved && <p className="text-sm text-green-700">Saved.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
