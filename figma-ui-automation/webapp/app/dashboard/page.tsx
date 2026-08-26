'use client';

import { useCallback, useEffect, useState } from 'react';
import ScreenCard, { type Screen } from '@/components/ScreenCard';
import RunProgress from '@/components/RunProgress';

export default function DashboardPage() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [runLabel, setRunLabel] = useState('');

  const refresh = useCallback(() => {
    fetch('/api/screens')
      .then((r) => r.json())
      .then((d) => setScreens(d.screens))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  async function run(pipeline: 'a' | 'b', screenId: string) {
    setStreamUrl(null);
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'pipeline', pipeline, screenId }),
    });
    const data = await res.json();
    if (data.streamUrl) {
      setRunLabel(`Pipeline ${pipeline.toUpperCase()} · ${screenId}`);
      setStreamUrl(data.streamUrl);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1f2933] mb-1">Dashboard</h1>
      <p className="text-[13px] text-[#52606d] mb-6">Registered screens and their orchestrator state.</p>

      {loading ? (
        <div className="text-[#52606d] text-sm">Loading…</div>
      ) : screens.length === 0 ? (
        <div className="bg-white border border-[#ede3da] rounded-xl p-8 text-center text-[#52606d] text-sm">
          No screens registered yet.
          <br />
          <span className="mono text-[12px]">npm run setup:sample</span> in the repo root, or run any pipeline to register a screen.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {screens.map((s) => (
            <ScreenCard key={s.id} screen={s} onRun={(p) => run(p, s.id)} />
          ))}
        </div>
      )}

      {runLabel && <div className="text-[12px] text-[#52606d] mt-4 font-medium">{runLabel}</div>}
      <RunProgress streamUrl={streamUrl} onDone={refresh} />
    </div>
  );
}
