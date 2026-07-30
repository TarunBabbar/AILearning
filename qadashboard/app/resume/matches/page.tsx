"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Job = {
  id: string;
  title: string;
  company: string;
  email?: string;
  location?: string;
  experience?: string;
  status: string;
  score?: number;
  strengths?: string;
  gaps?: string;
  createdAt: string;
};

export default function JobMatchesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {}
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchJobs();
    } catch {}
  };

  const filtered =
    filter === "all"
      ? jobs.filter((j) => j.status !== "deleted" && j.status !== "duplicate")
      : jobs.filter((j) => j.status === filter);

  const getScoreColor = (s?: number) => {
    if (!s) return "text-text-muted";
    if (s >= 60) return "text-green-600";
    if (s >= 30) return "text-amber-600";
    return "text-red-500";
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border px-6 py-3 bg-white">
        <h1 className="text-lg font-semibold text-text-primary">Job Matches</h1>
        <p className="text-sm text-text-muted">AI-scored job opportunities ranked by match strength</p>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-border px-4 py-2 bg-bg-surface flex gap-1 overflow-x-auto">
        {["all", "new", "emailed", "waiting", "interviewing", "offered", "ignored"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors capitalize whitespace-nowrap",
              filter === f
                ? "bg-white text-text-primary shadow-sm font-medium border border-border"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Job list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-text-muted" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">
              No jobs found. Upload job PDFs from the Resume page.
            </div>
          ) : (
            filtered.map((job) => (
              <button
                key={job.id}
                onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                className={cn(
                  "w-full text-left bg-white border border-border rounded-lg p-4 transition-colors hover:bg-bg-surface",
                  selectedJob?.id === job.id && "border-amber-500/50 bg-bg-surface"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary truncate">{job.title}</p>
                    <p className="text-sm text-text-muted truncate">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
                  </div>
                  <div className={cn("text-lg font-bold flex-shrink-0", getScoreColor(job.score))}>
                    {job.score ?? "—"}
                  </div>
                </div>
                {job.experience && (
                  <p className="text-xs text-text-muted mt-1">Exp: {job.experience}</p>
                )}
                <span className={cn(
                  "inline-block text-xs px-2 py-0.5 rounded-full mt-2",
                  job.status === "new" && "bg-blue-100 text-blue-700",
                  job.status === "emailed" && "bg-purple-100 text-purple-700",
                  job.status === "waiting" && "bg-amber-100 text-amber-700",
                  job.status === "interviewing" && "bg-green-100 text-green-700",
                  job.status === "offered" && "bg-emerald-100 text-emerald-700",
                  job.status === "ignored" && "bg-gray-100 text-gray-600",
                )}>
                  {job.status}
                </span>
              </button>
            ))
          )}
        </div>

        {/* Detail panel */}
        {selectedJob && (
          <div className="w-80 border-l border-border overflow-y-auto p-4 bg-white flex-shrink-0">
            <h2 className="font-semibold text-text-primary mb-1">{selectedJob.title}</h2>
            <p className="text-sm text-text-muted mb-3">{selectedJob.company}</p>

            {selectedJob.score !== undefined && (
              <div className="mb-3">
                <p className="text-xs text-text-muted mb-1">Match Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-bg-surface rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", selectedJob.score >= 60 ? "bg-green-500" : selectedJob.score >= 30 ? "bg-amber-500" : "bg-red-400")}
                      style={{ width: `${selectedJob.score}%` }}
                    />
                  </div>
                  <span className={cn("text-sm font-bold", getScoreColor(selectedJob.score))}>
                    {selectedJob.score}
                  </span>
                </div>
              </div>
            )}

            {selectedJob.strengths && (
              <div className="mb-3">
                <p className="text-xs text-text-muted mb-1">Strengths</p>
                <p className="text-sm text-green-700 bg-green-50 rounded-lg p-2">{selectedJob.strengths}</p>
              </div>
            )}
            {selectedJob.gaps && (
              <div className="mb-3">
                <p className="text-xs text-text-muted mb-1">Gaps</p>
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-2">{selectedJob.gaps}</p>
              </div>
            )}

            <div className="space-y-1 mt-4 pt-3 border-t border-border">
              <p className="text-xs text-text-muted">Status Workflow</p>
              {["new", "emailed", "waiting", "interviewing", "offered"].map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(selectedJob.id, s)}
                  className={cn(
                    "block w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors capitalize",
                    selectedJob.status === s
                      ? "bg-amber-500/10 text-amber-700 font-medium"
                      : "text-text-muted hover:bg-bg-hover"
                  )}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => updateStatus(selectedJob.id, "deleted")}
                className="block w-full text-left px-3 py-1.5 rounded-md text-sm text-red-500 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
