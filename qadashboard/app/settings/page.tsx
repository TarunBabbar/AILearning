"use client";

import { useState, useEffect } from "react";
import { Key, Mail, Database, Save, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    openrouterKey: "",
    gmailUser: "",
    gmailPass: "",
    llmModel: "google/gemma-4-26b-a4b-it:free",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data) setSettings((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) setMessage("Settings saved");
      else setMessage("Failed to save");
    } catch {
      setMessage("Failed to save");
    }
    setSaving(false);
  };

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Settings</h1>
      <p className="text-text-secondary mb-6">Configure API keys and preferences</p>

      <div className="space-y-4">
        {/* AI Model */}
        <div className="bg-white border border-border rounded-lg p-5">
          <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Database size={18} className="text-amber-500" />
            AI Model
          </h2>
          <select
            value={settings.llmModel}
            onChange={(e) => setSettings((prev) => ({ ...prev, llmModel: e.target.value }))}
            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
          >
            <option value="google/gemma-4-26b-a4b-it:free">Google Gemma 4 26B (free)</option>
            <option value="nvidia/nemotron-3-super-120b-a12b:free">NVIDIA Nemotron 3 Super (free)</option>
            <option value="meta-llama/llama-3.3-70b-instruct:free">Meta Llama 3.3 70B (free)</option>
            <option value="qwen/qwen3-next-80b-a3b-instruct:free">Qwen 3 Next 80B (free)</option>
            <option value="google/gemini-2.5-flash-lite">Google Gemini 2.5 Flash Lite</option>
            <option value="openrouter/free">OpenRouter Auto Free</option>
          </select>
        </div>

        {/* OpenRouter */}
        <div className="bg-white border border-border rounded-lg p-5">
          <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Key size={18} className="text-amber-500" />
            OpenRouter API Key
          </h2>
          <input
            type="password"
            value={settings.openrouterKey}
            onChange={(e) => setSettings((prev) => ({ ...prev, openrouterKey: e.target.value }))}
            placeholder="sk-or-v1-..."
            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
          />
          <p className="text-xs text-text-muted mt-1">
            Required for AI features. Get one from{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">
              openrouter.ai/keys
            </a>
          </p>
        </div>

        {/* Gmail */}
        <div className="bg-white border border-border rounded-lg p-5">
          <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Mail size={18} className="text-amber-500" />
            Gmail SMTP (for Email Agent)
          </h2>
          <div className="space-y-2">
            <input
              type="email"
              value={settings.gmailUser}
              onChange={(e) => setSettings((prev) => ({ ...prev, gmailUser: e.target.value }))}
              placeholder="your.email@gmail.com"
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
            />
            <input
              type="password"
              value={settings.gmailPass}
              onChange={(e) => setSettings((prev) => ({ ...prev, gmailPass: e.target.value }))}
              placeholder="App Password"
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Settings
        </button>

        {message && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">{message}</p>
        )}
      </div>
    </div>
  );
}
