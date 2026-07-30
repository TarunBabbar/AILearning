"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ResumePage() {
  const router = useRouter();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobFiles, setJobFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleResumeUpload = async () => {
    if (!resumeFile) return;
    setUploading(true);
    setMessage("");
    const form = new FormData();
    form.append("resume", resumeFile);
    try {
      const res = await fetch("/api/resume", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) setMessage(`Resume uploaded: ${data.filename}`);
      else setMessage(`Error: ${data.error}`);
    } catch {
      setMessage("Upload failed");
    }
    setUploading(false);
  };

  const handleJobsUpload = async () => {
    if (jobFiles.length === 0) return;
    setUploading(true);
    setMessage("");
    const form = new FormData();
    jobFiles.forEach((f) => form.append("jobs", f));
    try {
      const res = await fetch("/api/jobs", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) {
        setMessage(`${data.count} jobs extracted. Scoring now...`);
        // Trigger scoring
        const scoreRes = await fetch("/api/jobs/score", { method: "POST" });
        const scoreData = await scoreRes.json();
        setMessage(`Done! ${data.count} jobs extracted and scored.`);
        router.push("/resume/matches");
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Upload failed");
    }
    setUploading(false);
  };

  return (
    <div className="flex-1 p-6 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Resume & Job Matcher</h1>
      <p className="text-text-secondary mb-6">
        Upload your resume and job listing PDFs. AI extracts job details and scores matches.
      </p>

      {/* Resume upload */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
          <FileText size={18} className="text-amber-500" />
          Upload Resume
        </h2>
        <label className="flex items-center gap-3 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-amber-500/40 transition-colors">
          <Upload size={24} className="text-text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary font-medium">
              {resumeFile ? resumeFile.name : "Click to select resume (PDF/DOCX)"}
            </p>
          </div>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>
        {resumeFile && (
          <button
            onClick={handleResumeUpload}
            disabled={uploading}
            className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : "Upload Resume"}
          </button>
        )}
      </div>

      {/* Jobs upload */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
          <FileText size={18} className="text-amber-500" />
          Upload Job Listings
        </h2>
        <label className="flex items-center gap-3 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-amber-500/40 transition-colors">
          <Upload size={24} className="text-text-muted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-primary font-medium">
              {jobFiles.length > 0
                ? `${jobFiles.length} files selected`
                : "Click to select job PDFs (up to 20)"}
            </p>
          </div>
          <input
            type="file"
            accept=".pdf,.docx"
            multiple
            onChange={(e) => setJobFiles(Array.from(e.target.files || []))}
            className="hidden"
          />
        </label>
        {jobFiles.length > 0 && (
          <button
            onClick={handleJobsUpload}
            disabled={uploading}
            className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : "Upload & Extract Jobs"}
          </button>
        )}
      </div>

      {message && (
        <div className="bg-bg-surface border border-border rounded-lg p-3 text-sm text-text-secondary">
          {message}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <Link
          href="/resume/matches"
          className="flex items-center gap-1 px-4 py-2 bg-bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-bg-hover transition-colors"
        >
          View Matches <ArrowRight size={16} />
        </Link>
        <Link
          href="/resume/email"
          className="flex items-center gap-1 px-4 py-2 bg-bg-surface border border-border rounded-lg text-sm text-text-primary hover:bg-bg-hover transition-colors"
        >
          Email Agent <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
