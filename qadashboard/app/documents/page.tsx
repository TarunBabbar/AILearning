"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, FileText, Trash2, Loader2, ExternalLink } from "lucide-react";
import PageChrome from "@/components/ui/PageChrome";
import Button from "@/components/ui/Button";
import { GroupListSkeleton } from "@/components/ui/Skeleton";
import { invalidateListCaches, useListSWR } from "@/lib/use-list-swr";

type Document = { id: string; name: string; type: string; size: number; createdAt: string; chunkCount?: number };
type DocumentsResponse = { documents: Document[]; total: number };

function formatSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }

export default function DocumentsPage() {
  const { data, error, isLoading, mutate } = useListSWR<DocumentsResponse>("/api/documents");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const docs = data?.documents || [];
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files?.length) return; setUploading(true); setMessage(""); const form = new FormData(); Array.from(files).forEach((f) => form.append("files", f)); try { const res = await fetch("/api/documents", { method: "POST", body: form }); if (!res.ok) throw new Error("Upload failed"); await invalidateListCaches(); await mutate(); setMessage(`${files.length} document${files.length > 1 ? "s" : ""} uploaded.`); } catch { setMessage("Upload failed"); } finally { setUploading(false); e.target.value = ""; } };
  const deleteDoc = async (id: string) => { const res = await fetch(`/api/documents/${id}`, { method: "DELETE" }); if (res.ok) { await invalidateListCaches(); await mutate(); } };
  return <PageChrome maxWidthClass="max-w-5xl" header={<div className="flex items-center justify-between"><div><h1 className="text-lg font-semibold tracking-tight text-text-primary">Documents</h1><p className="mt-1 text-sm text-text-muted">Upload documents and ask AI questions about their content.</p></div><span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-strong">{data?.total || 0} documents</span></div>}><div className="space-y-4 pb-8"><label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-border bg-white p-5 shadow-sm transition-colors hover:border-amber-500/50 hover:bg-accent-soft/20"><span className="rounded-lg bg-accent-soft p-2.5 text-accent-strong"><Upload size={21} /></span><div className="flex-1"><p className="text-sm font-medium text-text-primary">Upload documents</p><p className="mt-1 text-xs text-text-muted">PDF, DOCX, TXT, MD, CSV, XLSX</p></div>{uploading && <Loader2 size={18} className="animate-spin text-amber-600" />}<input type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.xlsx" onChange={handleUpload} className="hidden" /></label>{message && <div className="rounded-lg border border-border bg-white p-3 text-sm text-text-secondary">{message}</div>}{error ? <div className="rounded-xl border border-border bg-white p-12 text-center text-sm text-red-600">Failed to load documents.</div> : isLoading && !data ? <GroupListSkeleton /> : docs.length === 0 ? <div className="rounded-xl border border-border bg-white p-16 text-center"><FileText size={32} className="mx-auto mb-3 text-amber-500" /><p className="font-medium text-text-primary">No documents yet</p><p className="mt-1 text-sm text-text-muted">Upload one to get started.</p></div> : <div className="grid gap-3 md:grid-cols-2">{docs.map((doc) => <div key={doc.id} className="group rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start gap-3"><span className="rounded-lg bg-bg-surface p-2.5 text-amber-600"><FileText size={19} /></span><div className="min-w-0 flex-1"><p className="truncate font-medium text-text-primary">{doc.name}</p><p className="mt-1 text-xs text-text-muted">{doc.type.toUpperCase()} · {formatSize(doc.size)}{doc.chunkCount ? ` · ${doc.chunkCount} chunks` : ""}</p></div></div><div className="mt-4 flex items-center justify-end gap-2"><Link href={`/documents/${doc.id}`} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">Ask AI <ExternalLink size={13} /></Link><Button variant="danger" size="sm" onClick={() => deleteDoc(doc.id)}><Trash2 size={14} /></Button></div></div>)}</div>}</div></PageChrome>;
}
