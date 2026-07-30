"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Send, Settings } from "lucide-react";

type Job = {
  id: string;
  title: string;
  company: string;
  email?: string;
  score?: number;
  emailSent: boolean;
};

export default function EmailAgentPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<"high" | "low" | "ignored">("high");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [gmailUser, setGmailUser] = useState("");
  const [gmailPass, setGmailPass] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => setJobs(data.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredJobs = jobs.filter((j) => {
    if (filter === "high") return (j.score ?? 0) >= 60 && !j.emailSent;
    if (filter === "low") return (j.score ?? 0) < 60 && !j.emailSent;
    return !j.emailSent;
  });

  const sendEmail = async (job: Job) => {
    if (!gmailUser || !gmailPass) {
      setShowSettings(true);
      return;
    }
    setSending(job.id);
    try {
      await fetch("/api/jobs/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, gmailUser, gmailPass }),
      });
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, emailSent: true } : j))
      );
    } catch {}
    setSending(null);
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Email Agent</h1>
          <p className="text-sm text-text-muted">Send personalized job applications via Gmail</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-bg-surface border border-border rounded-lg hover:bg-bg-hover"
        >
          <Settings size={16} />
          Gmail Settings
        </button>
      </div>

      {showSettings && (
        <div className="bg-white border border-border rounded-lg p-4 mb-4 space-y-3">
          <h3 className="font-medium text-sm">Gmail SMTP Credentials</h3>
          <input
            type="email"
            placeholder="your.email@gmail.com"
            value={gmailUser}
            onChange={(e) => setGmailUser(e.target.value)}
            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
          />
          <input
            type="password"
            placeholder="App Password"
            value={gmailPass}
            onChange={(e) => setGmailPass(e.target.value)}
            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
          />
          <p className="text-xs text-text-muted">
            Use a Gmail App Password (not your regular password). Generate one from Google Account &gt; Security &gt; App Passwords.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-bg-surface rounded-lg border border-border p-0.5 w-fit">
        {(["high", "low", "ignored"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm capitalize transition-colors",
              filter === f
                ? "bg-white text-text-primary shadow-sm font-medium"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            {f} Score ({filteredJobs.length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-text-muted" /></div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">No jobs to email. Upload and score jobs first.</div>
      ) : (
        <div className="space-y-2">
          {filteredJobs.map((job) => (
            <div key={job.id} className="bg-white border border-border rounded-lg p-4 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text-primary truncate">{job.title}</p>
                <p className="text-sm text-text-muted truncate">{job.company} {job.email ? `· ${job.email}` : ""}</p>
              </div>
              <button
                onClick={() => sendEmail(job)}
                disabled={sending === job.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors flex-shrink-0 ml-3"
              >
                {sending === job.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
