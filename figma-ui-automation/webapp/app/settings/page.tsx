'use client';

import { useEffect, useState } from 'react';
import ConfigForm from '@/components/ConfigForm';

interface Health {
  hasOpenRouterKey: boolean;
  hasFigmaToken: boolean;
  hasStagingUrl: boolean;
  deepevalMode: string;
  mode: string;
  dryRun: boolean;
  dbExists: boolean;
  envExists: boolean;
}

export default function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  const row = (label: string, ok: boolean) => (
    <div className="flex items-center justify-between py-2 border-b border-[#f0eae2] last:border-0">
      <span className="text-[12.5px] text-[#52606d]">{label}</span>
      <span className={`text-[12px] font-medium ${ok ? 'text-green-700' : 'text-amber-700'}`}>{ok ? 'configured' : 'missing'}</span>
    </div>
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-[#1f2933] mb-1">Settings</h1>
      <p className="text-[13px] text-[#52606d] mb-6">Environment configuration for the pipeline (.env).</p>

      <div className="bg-white border border-[#ede3da] rounded-xl p-5 mb-6">
        <h2 className="text-[13px] font-semibold text-[#1f2933] mb-2">Pipeline Health</h2>
        {health ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {row('OpenRouter API key', health.hasOpenRouterKey)}
            {row('Figma access token', health.hasFigmaToken)}
            {row('Staging URL', health.hasStagingUrl)}
            {row('State database', health.dbExists)}
            {row('.env file', health.envExists)}
            <div className="py-2 border-b border-[#f0eae2] text-[12.5px] text-[#52606d] flex justify-between">
              <span>Mode / Dry-run / Eval</span>
              <span className="mono text-[11.5px] text-[#1f2933]">{health.mode} · {String(health.dryRun)} · {health.deepevalMode}</span>
            </div>
          </div>
        ) : (
          <div className="text-[#52606d] text-sm">Loading…</div>
        )}
      </div>

      <div className="bg-white border border-[#ede3da] rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-[#1f2933] mb-4">Environment (.env)</h2>
        <ConfigForm />
      </div>
    </div>
  );
}
