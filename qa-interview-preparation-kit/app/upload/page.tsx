"use client";

import { useState, useRef } from "react";
import { Upload, File, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ name: string; chunks: number; success: boolean }[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
    );
    setFiles((prev) => [...prev, ...dropped]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setResults([]);

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        setResults((prev) => [
          ...prev,
          { name: file.name, chunks: data.chunks || 0, success: data.success },
        ]);
      } catch {
        setResults((prev) => [
          ...prev,
          { name: file.name, chunks: 0, success: false },
        ]);
      }
    }

    setFiles([]);
    setUploading(false);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-claude-text">Upload Documents</h2>
        <p className="text-sm text-claude-text-muted mt-1">
          Add QA interview PDFs to the vector database for searching.
        </p>
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
          files.length > 0
            ? "border-claude-accent bg-claude-accent/5"
            : "border-claude-border hover:border-claude-text-light"
        }`}
      >
        <Upload size={40} className="mx-auto mb-4 text-claude-text-light" />
        <p className="text-claude-text font-medium mb-1">
          Drop PDF files here
        </p>
        <p className="text-sm text-claude-text-muted mb-4">or</p>
        <label className="claude-btn-primary inline-flex cursor-pointer">
          Browse Files
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium text-claude-text">
            {files.length} file(s) selected
          </p>
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 bg-white border border-claude-border rounded-xl"
            >
              <File size={18} className="text-claude-accent shrink-0" />
              <span className="text-sm text-claude-text flex-1 truncate">
                {file.name}
              </span>
              <span className="text-xs text-claude-text-light">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                onClick={() => removeFile(i)}
                className="p-1 hover:bg-claude-beige-dark rounded-lg transition-colors"
              >
                <X size={16} className="text-claude-text-muted" />
              </button>
            </div>
          ))}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="claude-btn-primary w-full mt-4 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload & Index
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-8 space-y-3">
          <h3 className="text-sm font-semibold text-claude-text">Results</h3>
          {results.map((r, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-4 rounded-xl border ${
                r.success
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              {r.success ? (
                <CheckCircle size={20} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={20} className="text-red-500 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-claude-text">{r.name}</p>
                {r.success && (
                  <p className="text-xs text-claude-text-muted">
                    {r.chunks} chunks indexed
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
