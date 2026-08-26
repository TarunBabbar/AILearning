'use client';

import { useCallback, useEffect, useState } from 'react';
import RunProgress from '@/components/RunProgress';
import type { Screen } from '@/components/ScreenCard';

const AGENTS = [
  { id: 'design', label: 'Design Extraction', desc: 'Figma → design-spec.json' },
  { id: 'inspect', label: 'Implementation Inspector', desc: 'staging URL → impl-spec.json' },
  { id: 'validate', label: 'Validation / Diff', desc: 'both specs → drift report' },
  { id: 'testgen', label: 'Test Case Generation', desc: 'design-spec → test-cases.yaml' },
  { id: 'codegen', label: 'Automation Codegen', desc: 'approved cases → .spec.ts' },
  { id: 'eval', label: 'Evaluation', desc: 'DeepEval sidecar / mock judge' },
];

export default function AgentsPage() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [screenId, setScreenId] = useState('');
  const [agentId, setAgentId] = useState('design');
  const [sample, setSample] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch('/api/screens').then((r) => r.json()).then((d) => setScreens(d.screens));
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
      body: JSON.stringify({ kind: 'agent', agent: agentId, screenId, sample }),
    });
    const data = await res.json();
    if (data.streamUrl) setStreamUrl(data.streamUrl);
  }

  const input = 'rounded-md border border-[#d9cec2] bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-600/30';
  const label = 'block text-[12px] font-medium text-[#52606d] mb-1';

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1f2933] mb-1">Agents</h1>
      <p className="text-[13px] text-[#52606d] mb-6">Run any single agent in isolation.</p>

      <div className="bg-white border border-[#ede3da] rounded-xl p-5 mb-6 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className={label}>Agent</label>
            <select className={`${input} w-full`} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Screen</label>
            <select className={`${input} w-full`} value={screenId} onChange={(e) => setScreenId(e.target.value)}>
              <option value="">Select…</option>
              {screens.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={run} disabled={!screenId} className="w-full rounded-md bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white text-[13px] font-medium py-2 transition-colors">
              Run
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 text-[12px] text-[#52606d]">
          <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} className="accent-amber-700" />
          sample mode (bundled data, no keys needed)
        </label>
        <RunProgress streamUrl={streamUrl} onDone={refresh} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAgentId(a.id)}
            className={`text-left rounded-xl border p-4 transition-colors ${
              agentId === a.id ? 'border-amber-700 bg-amber-50' : 'border-[#ede3da] bg-white hover:border-[#d9cec2]'
            }`}
          >
            <div className="text-[13px] font-semibold text-[#1f2933]">{a.label}</div>
            <div className="text-[11.5px] text-[#52606d] mt-0.5 mono">{a.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
