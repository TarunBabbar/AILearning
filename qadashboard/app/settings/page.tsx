"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, XCircle, Database } from "lucide-react";
import PageChrome from "@/components/ui/PageChrome";
import Button from "@/components/ui/Button";

type ModelOption = { id: string; name: string };
type Status = { openrouter: boolean; gmail: boolean; pinecone: boolean };

export default function SettingsPage() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [llmModel, setLlmModel] = useState("");
  const [status, setStatus] = useState<Status>({ openrouter: false, gmail: false, pinecone: false });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.models?.length > 0) {
          setModels(data.models);
          setLlmModel(data.llmModel || data.models[0].id);
        }
        if (data.status) setStatus(data.status);
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
        body: JSON.stringify({ llmModel }),
      });
      if (res.ok) setMessage("Model preference saved");
      else setMessage((await res.json()).error || "Failed to save");
    } catch {
      setMessage("Failed to save");
    }
    setSaving(false);
  };

  const statusCard = (label: string, ok: boolean) => (
    <div className="flex items-center justify-between bg-white border border-border rounded-lg p-4">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      {ok ? (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <CheckCircle2 size={16} /> Configured
        </span>
      ) : (
        <span className="flex items-center gap-1 text-sm text-text-muted">
          <XCircle size={16} /> Not configured
        </span>
      )}
    </div>
  );

  return (
    <PageChrome maxWidthClass="max-w-3xl" header={<div><h1 className="text-lg font-semibold tracking-tight text-text-primary">Settings</h1><p className="mt-1 text-sm text-text-muted">Pick your AI model and review service status.</p></div>}>
      <div className="space-y-4 pb-8">
        {/* AI Model */}
        <div className="bg-white border border-border rounded-lg p-5">
          <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Database size={18} className="text-amber-500" />
            AI Model (free only)
          </h2>
          {models.length > 0 ? (
            <select
              value={llmModel}
              onChange={(e) => setLlmModel(e.target.value)}
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-text-muted">No models configured (check LLM_MODELS_JSON in .env).</p>
          )}
          <p className="text-xs text-text-muted mt-2">
            The app refuses to call anything that isn&apos;t a free (:free) model.
          </p>
        </div>

        {/* Service status */}
        <div className="bg-white border border-border rounded-lg p-5">
          <h2 className="font-semibold text-text-primary mb-3">Service Status</h2>
          <div className="space-y-2">
            {statusCard("OpenRouter (AI)", status.openrouter)}
            {statusCard("Gmail SMTP (Email Agent)", status.gmail)}
            {statusCard("Pinecone (vector search)", status.pinecone)}
          </div>
          <p className="text-xs text-text-muted mt-2">
            These come from environment variables in .env. API keys are never stored in the database.
          </p>
        </div>

        <Button
          onClick={save}
          disabled={saving || models.length === 0}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Model Preference
        </Button>

        {message && (
          <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">{message}</p>
        )}
      </div>
    </PageChrome>
  );
}
