"use client";

import { useState, useEffect, useMemo } from "react";
import { ChatArea } from "@/components/ui/ChatArea";
import { Sparkles, Database, Cpu, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PageChrome from "@/components/ui/PageChrome";
import { useListSWR } from "@/lib/use-list-swr";

type ModelOption = { id: string; name: string };
type Conversation = { id: string; title: string | null; createdAt: string; messageCount: number };
type ConversationsResponse = { conversations: Conversation[] };

export default function QAPage() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [model, setModel] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const { data, mutate } = useListSWR<ConversationsResponse>("/api/conversations?module=qa");
  const conversations = data?.conversations || [];

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => { if (d.models?.length > 0) { setModels(d.models); setModel(d.llmModel || d.models[0].id); } })
      .catch(() => undefined);
  }, []);

  const startNewConversation = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module: "qa" }) });
      const d = await res.json();
      if (!res.ok) return null;
      setConversationId(d.conversation.id);
      await mutate();
      return d.conversation.id;
    } catch { return null; }
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => undefined);
    if (conversationId === id) setConversationId(null);
    await mutate();
  };

  return <PageChrome maxWidthClass="max-w-7xl" header={<div className="flex items-center justify-between gap-4"><div><h1 className="text-lg font-semibold tracking-tight text-text-primary">QA Interview Assistant</h1><p className="mt-1 text-sm text-text-muted">Ask questions about QA, testing, automation, and more — grounded in 510 interview Q&A.</p></div><div className="flex items-center gap-2">{models.length > 0 && <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-text-secondary outline-none focus:border-amber-500"><option value="" disabled>Model</option>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>}</div></div>}><div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm"><div className="flex flex-1 flex-col overflow-hidden"><div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-bg-page/60 px-4 py-2 text-xs text-text-muted"><span className="inline-flex items-center gap-1 font-medium text-text-secondary"><Sparkles size={13} className="text-amber-500" />Ask question</span><ArrowRight size={13} /><span className="inline-flex items-center gap-1"><Database size={13} className="text-amber-500" />510 Q&A knowledge base</span><ArrowRight size={13} /><span className="inline-flex items-center gap-1 font-medium text-text-secondary"><Cpu size={13} className="text-amber-500" />{model.split("/")[1]?.split(":")[0] || "LLM"}</span></div><ChatArea placeholder="Ask a QA interview question..." namespace="__default__" showSources={true} model={model || undefined} conversationId={conversationId} onNewConversation={startNewConversation} /></div>{conversations.length > 0 && <div className="hidden w-60 shrink-0 overflow-y-auto border-l border-border bg-bg-page/40 p-2 md:block"><p className="px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-wider text-text-muted">History</p><div className="space-y-0.5">{conversations.map((c) => <div key={c.id} className="group relative"><button onClick={() => setConversationId(c.id)} className={cn("w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors pr-8", conversationId === c.id ? "border border-border bg-white font-medium text-text-primary shadow-sm" : "text-text-secondary hover:bg-white/60")}><span className="block truncate">{c.title || "New conversation"}</span><span className="text-xs text-text-muted">{c.messageCount} msgs</span></button><button onClick={() => deleteConversation(c.id)} className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded p-0.5 text-text-muted hover:text-red-500 group-hover:block" title="Delete"><X size={13} /></button></div>)}</div></div>}</div></PageChrome>;
}
