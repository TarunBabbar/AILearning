'use client';

import { useCallback, useEffect, useState } from 'react';

interface RunRow {
  id: string;
  screenId: string;
  agent: string;
  status: string;
  message: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  success: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
  pending: 'bg-amber-50 text-amber-800',
  skipped: 'bg-gray-100 text-gray-600',
};

export default function RunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch('/api/screens')
      .then((r) => r.json())
      .then(async (d) => {
        const details = await Promise.all(
          (d.screens as Array<{ id: string }>).map((s) => fetch(`/api/screens/${s.id}`).then((r) => r.json())),
        );
        return details.flatMap((x) => (x.runs as RunRow[]) ?? []);
      })
      .then((all) => all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      .then((all) => setRuns(all))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pill = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium';

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1f2933] mb-1">Runs</h1>
      <p className="text-[13px] text-[#52606d] mb-6">Run history from the orchestrator state store.</p>

      {loading ? (
        <div className="text-[#52606d] text-sm">Loading…</div>
      ) : runs.length === 0 ? (
        <div className="bg-white border border-[#ede3da] rounded-xl p-8 text-center text-[#52606d] text-sm">
          No runs yet — run a pipeline or agent to see history.
        </div>
      ) : (
        <div className="bg-white border border-[#ede3da] rounded-xl overflow-hidden">
          <table className="w-full text-left text-[12.5px]">
            <thead className="bg-[#faf7f5] text-[#52606d] text-[11px] uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Screen</th>
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Message</th>
                <th className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eae2]">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-[#faf7f5]">
                  <td className="px-4 py-2.5 mono text-[11.5px] text-[#1f2933]">{r.screenId}</td>
                  <td className="px-4 py-2.5 mono text-[11.5px] text-[#52606d]">{r.agent}</td>
                  <td className="px-4 py-2.5">
                    <span className={`${pill} ${STATUS_STYLE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[11.5px] text-[#52606d] max-w-md truncate">{r.message ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[11px] text-[#9aa5b1]">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
