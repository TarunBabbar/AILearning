"use client";

import { useState } from "react";
import { ChatArea } from "@/components/ui/ChatArea";
import { Sparkles, Database, Cpu, ArrowRight } from "lucide-react";

const FREE_MODELS = [
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "NVIDIA Nemotron 3 Super" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Meta Llama 3.3 70B" },
  { id: "qwen/qwen3-next-80b-a3b-instruct:free", name: "Qwen 3 Next 80B" },
  { id: "tencent/hy3:free", name: "Tencent Hy3" },
];

export default function QAPage() {
  const [model, setModel] = useState(FREE_MODELS[0].id);

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-6 py-3 bg-white flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">QA Interview Assistant</h1>
          <p className="text-sm text-text-muted">
            Ask questions about QA, testing, automation, and more. Powered by 400+ interview Q&A.
          </p>
        </div>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="text-xs bg-bg-surface border border-border rounded-md px-2.5 py-1.5 text-text-secondary focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          {FREE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Pipeline explainer */}
      <div className="px-6 py-2.5 bg-bg-surface/60 border-b border-border">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1 font-medium text-text-secondary">
            <Sparkles size={13} className="text-amber-500" /> Ask Question
          </span>
          <ArrowRight size={13} className="text-text-muted" />
          <span className="inline-flex items-center gap-1">
            <Database size={13} className="text-amber-500" /> RAG + Pinecone
          </span>
          <ArrowRight size={13} className="text-text-muted" />
          <span className="inline-flex items-center gap-1">
            <Database size={13} className="text-amber-500" /> text-embedding-3-small
          </span>
          <ArrowRight size={13} className="text-text-muted" />
          <span className="inline-flex items-center gap-1 font-medium text-text-secondary">
            <Cpu size={13} className="text-amber-500" /> LLM ({model.split("/")[1]?.split(":")[0]})
          </span>
        </div>
      </div>

      <ChatArea
        placeholder="Ask a QA interview question..."
        namespace="__default__"
        showSources={true}
        model={model}
      />
    </div>
  );
}
