'use client';

import { useCallback, useEffect, useState } from 'react';
import RunProgress from '@/components/RunProgress';
import type { Screen } from '@/components/ScreenCard';

export default function ValidationPage() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [screenId, setScreenId] = useState('');
  const [sample, setSample] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [reports, setReports] = useState<Array<{ name: string; mtime: string }>>([]);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch('/api/screens').then((r) => r.json()).then((d) => setScreens(d.screens));
    fetch('/api/reports').then((r) => r.json()).then((d) => setReports(d.drift));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run() {
    if (!screenId) return;
    setStreamUrl(null);
    setSelectedReport(null);
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'pipeline', pipeline: 'a', screenId, sample }),
    });
    const data = await res.json();
    if (data.streamUrl) setStreamUrl(data.streamUrl);
  }

  const input = 'rounded-md border border-[#d9cec2] bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-600/30';
  const label = 'block text-[12px] font-medium text-[#52606d] mb-1';

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1f2933] mb-1">Validation — Pipeline A</h1>
      <p className="text-[13px] text-[#52606d] mb-6">Validate a built screen against its Figma design (design → impl → drift report).</p>

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
              Run Validation
            </button>
          </div>
        </div>
        <RunProgress streamUrl={streamUrl} onDone={refresh} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-[13px] font-semibold text-[#1f2933] mb-2">Drift Reports</h2>
          <div className="bg-white border border-[#ede3da] rounded-xl divide-y divide-[#f0eae2]">
            {reports.length === 0 && <div className="p-4 text-[#9aa5b1] text-[12.5px]">No drift reports yet.</div>}
            {reports.map((r) => (
              <button key={r.name} onClick={() => setSelectedReport(r.name)} className="w-full text-left px-4 py-3 hover:bg-[#faf7f5] transition-colors">
                <div className="text-[12.5px] font-medium text-[#1f2933]">{r.name.replace('.html', '')}</div>
                <div className="text-[11px] text-[#9aa5b1] mono">{new Date(r.mtime).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-[13px] font-semibold text-[#1f2933] mb-2">Preview</h2>
          {selectedReport ? (
            <iframe src={`/api/reports/${encodeURIComponent(selectedReport)}`} className="w-full h-[560px] border border-[#ede3da] rounded-xl bg-white" />
          ) : (
            <div className="bg-white border border-[#ede3da] rounded-xl h-[560px] flex items-center justify-center text-[#9aa5b1] text-[12.5px]">
              Select a report to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
