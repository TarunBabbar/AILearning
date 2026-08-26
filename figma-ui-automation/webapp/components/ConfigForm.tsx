'use client';

import { useEffect, useState } from 'react';

interface EnvState {
  OPENROUTER_API_KEY: string;
  FIGMA_ACCESS_TOKEN: string;
  FIGMA_FILE_KEY: string;
  STAGING_URL: string;
  MODE: 'live' | 'sample';
  DRY_RUN: boolean;
  DEEPEVAL_MODE: 'mock' | 'server';
  DEEPEVAL_URL: string;
}

const EMPTY: EnvState = {
  OPENROUTER_API_KEY: '',
  FIGMA_ACCESS_TOKEN: '',
  FIGMA_FILE_KEY: '',
  STAGING_URL: '',
  MODE: 'live',
  DRY_RUN: true,
  DEEPEVAL_MODE: 'mock',
  DEEPEVAL_URL: 'http://127.0.0.1:8010',
};

export default function ConfigForm() {
  const [cfg, setCfg] = useState<EnvState>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => {
        setCfg({
          OPENROUTER_API_KEY: data.OPENROUTER_API_KEY ?? '',
          FIGMA_ACCESS_TOKEN: data.FIGMA_ACCESS_TOKEN ?? '',
          FIGMA_FILE_KEY: data.figmaFileKey ?? '',
          STAGING_URL: data.stagingUrl ?? '',
          MODE: data.mode ?? 'live',
          DRY_RUN: data.dryRun ?? true,
          DEEPEVAL_MODE: data.deepevalMode ?? 'mock',
          DEEPEVAL_URL: data.deepevalUrl ?? 'http://127.0.0.1:8010',
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const set = <K extends keyof EnvState>(k: K, v: EnvState[K]) => setCfg((prev) => ({ ...prev, [k]: v }));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const data = await res.json();
      if (res.ok) setMsg({ ok: true, text: `Saved — mode ${data.saved.mode}, dry-run ${data.saved.dryRun}` });
      else setMsg({ ok: false, text: data.error ?? 'Save failed' });
    } catch {
      setMsg({ ok: false, text: 'Network error' });
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="text-[#52606d] text-sm">Loading…</div>;

  const input = 'w-full rounded-md border border-[#d9cec2] bg-white px-3 py-2 text-[13px] text-[#1f2933] focus:outline-none focus:ring-2 focus:ring-amber-600/30 focus:border-amber-700';
  const label = 'block text-[12px] font-medium text-[#52606d] mb-1';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={label}>OpenRouter API Key</label>
          <input type={showSecrets ? 'text' : 'password'} className={input} value={cfg.OPENROUTER_API_KEY} onChange={(e) => set('OPENROUTER_API_KEY', e.target.value)} placeholder="sk-or-…" />
        </div>
        <div>
          <label className={label}>Figma Access Token</label>
          <input type={showSecrets ? 'text' : 'password'} className={input} value={cfg.FIGMA_ACCESS_TOKEN} onChange={(e) => set('FIGMA_ACCESS_TOKEN', e.target.value)} placeholder="figd_…" />
        </div>
        <div>
          <label className={label}>Figma File Key</label>
          <input type="text" className={input} value={cfg.FIGMA_FILE_KEY} onChange={(e) => set('FIGMA_FILE_KEY', e.target.value)} placeholder="abc123…" />
        </div>
        <div>
          <label className={label}>Staging URL</label>
          <input type="text" className={input} value={cfg.STAGING_URL} onChange={(e) => set('STAGING_URL', e.target.value)} placeholder="https://staging.example.com" />
        </div>
        <div>
          <label className={label}>Mode</label>
          <select className={input} value={cfg.MODE} onChange={(e) => set('MODE', e.target.value as EnvState['MODE'])}>
            <option value="live">live</option>
            <option value="sample">sample</option>
          </select>
        </div>
        <div>
          <label className={label}>DRY_RUN (auto-approve gates)</label>
          <select className={input} value={String(cfg.DRY_RUN)} onChange={(e) => set('DRY_RUN', e.target.value === 'true')}>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
        <div>
          <label className={label}>DeepEval Mode</label>
          <select className={input} value={cfg.DEEPEVAL_MODE} onChange={(e) => set('DEEPEVAL_MODE', e.target.value as EnvState['DEEPEVAL_MODE'])}>
            <option value="mock">mock</option>
            <option value="server">server</option>
          </select>
        </div>
        <div>
          <label className={label}>DeepEval URL</label>
          <input type="text" className={input} value={cfg.DEEPEVAL_URL} onChange={(e) => set('DEEPEVAL_URL', e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="rounded-md bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2 transition-colors">
          {saving ? 'Saving…' : 'Save .env'}
        </button>
        <button onClick={() => setShowSecrets((v) => !v)} className="text-[12px] text-[#52606d] hover:text-[#1f2933]">
          {showSecrets ? 'Hide' : 'Show'} secrets
        </button>
        {msg && <span className={`text-[12.5px] ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
      </div>

      <p className="text-[11.5px] text-[#9aa5b1]">
        Saved to <span className="mono">.env</span> in the repo root. Values take effect on the next run — no restart needed.
      </p>
    </div>
  );
}
