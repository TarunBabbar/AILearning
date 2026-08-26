'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import RunProgress from '@/components/RunProgress';
import type { Screen } from '@/components/ScreenCard';

export default function ShiftLeftPage() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [screenId, setScreenId] = useState('');
  const [sample, setSample] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [casesSummary, setCasesSummary] = useState<Array<{ screenId: string; provider: string; total: number; generatedAt: string }>>([]);

  const refresh = useCallback(() => {
    fetch('/api/screens').then((r) => r.json()).then((d) => setScreens(d.screens));
    fetch('/api/reports').then((r) => r.json()).then((d) => setCasesSummary(d.testcases));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run() {
    if (!screenId) return;
    setStreamUrl(null);
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'pipeline', pipeline: 'b', screenId, sample }),
    });
    const data = await res.json();
    if (data.streamUrl) setStreamUrl(data.streamUrl);
  }

  const input = 'rounded-md border border-[#d9cec2] bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-600/30';
  const label = 'block text-[12px] font-medium text-[#52606d] mb-1';

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1f2933] mb-1">Shift-Left — Pipeline B</h1>
      <p className="text-[13px] text-[#52606d] mb-6">Generate test cases + Playwright automation for screens still in design, before dev finishes.</p>

      <div className="bg-white border border-[#ede3da] rounded-xl p-5 mb-6 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={label}>Screen</label>
            <select className={`${input} w-full`} value={screenId} onChange={(e) => setScreenId(e.target.value)}>
              <option value="">Select…</option>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Mode</label>
            <select className={`${input} w-full`} value={sample ? 'sample' : 'live'} onChange={(e) => setSample(e.target.value === 'sample')}>
              <option value="live">live</option>
              <option value="sample">sample</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={run} disabled={!screenId} className="w-full rounded-md bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white text-[13px] font-medium py-2 transition-colors">
              Generate Tests
            </button>
          </div>
        </div>
        <RunProgress streamUrl={streamUrl} onDone={refresh} />
      </div>

      <div>
        <h2 className="text-[13px] font-semibold text-[#1f2933] mb-2">Generated Test Case Files</h2>
        <div className="bg-white border border-[#ede3da] rounded-xl divide-y divide-[#f0eae2]">
          {casesSummary.length === 0 && <div className="p-4 text-[#9aa5b1] text-[12.5px]">No test cases generated yet.</div>}
          {casesSummary.map((t) => (
            <div key={t.screenId} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-[12.5px] font-medium text-[#1f2933]">{t.screenId}</div>
                <div className="text-[11px] text-[#9aa5b1] mono">{t.provider} · {t.total} cases · {new Date(t.generatedAt).toLocaleString()}</div>
              </div>
              <Link href="/review" className="text-[12px] font-medium text-amber-700 hover:text-amber-800">
                Review →
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
