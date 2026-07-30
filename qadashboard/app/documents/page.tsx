"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, FileText, Trash2, Loader2, ExternalLink, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Document = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocs(data.documents || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    try {
      await fetch("/api/documents", { method: "POST", body: form });
      fetchDocs();
    } catch {}
    setUploading(false);
  };

  const deleteDoc = async (id: string) => {
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {}
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Documents</h1>
          <p className="text-sm text-text-muted">Upload documents and ask AI questions about them</p>
        </div>
      </div>

      {/* Upload zone */}
      <label className="flex items-center gap-3 p-4 mb-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-amber-500/40 transition-colors bg-white">
        <Upload size={24} className="text-text-muted flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">Upload documents</p>
          <p className="text-xs text-text-muted">PDF, DOCX, TXT, MD, CSV, XLSX</p>
        </div>
        {uploading && <Loader2 size={18} className="animate-spin text-text-muted" />}
        <input type="file" multiple accept=".pdf,.docx,.txt,.md,.csv,.xlsx" onChange={handleUpload} className="hidden" />
      </label>

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-text-muted" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm bg-white border border-border rounded-lg">
          <FileText size={40} className="mx-auto mb-2 opacity-40" />
          <p>No documents yet. Upload one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="bg-white border border-border rounded-lg p-4 flex items-center justify-between hover:bg-bg-surface transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileText size={20} className="text-text-muted flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-text-primary truncate">{doc.name}</p>
                  <p className="text-xs text-text-muted">
                    {doc.type.toUpperCase()} · {formatSize(doc.size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                <Link
                  href={`/documents/${doc.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                >
                  Ask AI <ExternalLink size={14} />
                </Link>
                <button
                  onClick={() => deleteDoc(doc.id)}
                  className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
