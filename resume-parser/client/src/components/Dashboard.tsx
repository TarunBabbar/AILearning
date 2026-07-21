import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { Job } from "@/lib/types";
import { cn, getScoreColor, getScoreBg, isCompanyEmail, isValidJobTitle, formatDate } from "@/lib/utils";
import { Search, Trash2, X, FileText, Upload, MapPin, Clock, Mail, Award, Building2, Plus, RefreshCw, ChevronDown } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  new: "New", email_sent: "Email Sent", waiting_reply: "Waiting",
  interviewing: "Interviewing", offer_received: "Offered", ignored: "Ignored", duplicate: "Duplicate"
};

const STATUS_DOT: Record<string, string> = {
  new: "bg-blue-500", email_sent: "bg-emerald-500", waiting_reply: "bg-amber-500",
  interviewing: "bg-violet-500", offer_received: "bg-emerald-600", ignored: "bg-stone-300", duplicate: "bg-zinc-400"
};

export default function Dashboard() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobFiles, setJobFiles] = useState<File[]>([]);
  const [resumeName, setResumeName] = useState("");
  const [statsJobs, setStatsJobs] = useState(0);
  const [allResults, setAllResults] = useState<Job[]>([]);
  const [filteredResults, setFilteredResults] = useState<Job[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [detailJob, setDetailJob] = useState<{ job: Job } | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [topScore, setTopScore] = useState("");
  const [matches, setMatches] = useState("");
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [scoreScope, setScoreScope] = useState("unscored");

  const isBadData = useCallback((j: Job) => {
    if (!j.email) return true;
    if (j.company === "Unknown Company" || !j.company) return true;
    if (!isCompanyEmail(j.email, j.company)) return true;
    if (!isValidJobTitle(j.title)) return true;
    return false;
  }, []);

  const computeStatusCounts = useCallback((jobs: Job[]) => {
    const counts: Record<string, number> = { all: 0, new: 0, email_sent: 0, waiting_reply: 0, interviewing: 0, offer_received: 0, ignored: 0, duplicate: 0 };
    for (const j of jobs) {
      const st = j.status || "new";
      if (st === "duplicate") { counts.duplicate++; continue; }
      if (st === "ignored") { counts.ignored++; continue; }
      if (isBadData(j)) { counts.ignored++; continue; }
      if (counts[st] !== undefined) counts[st]++;
      counts.all++;
    }
    return counts;
  }, [isBadData]);

  const applyFilter = useCallback((results: Job[], filter: string) => {
    return results.filter(j => {
      const st = j.status || "new";
      if (filter === "duplicate") return st === "duplicate";
      if (filter === "ignored") return st === "ignored" || isBadData(j);
      if (st === "duplicate" || st === "ignored" || isBadData(j)) return false;
      if (filter !== "all") return st === filter;
      return true;
    });
  }, [isBadData]);

  useEffect(() => {
    api.getStatus().then(s => {
      if (s.resume_loaded) setResumeName(s.resume_filename);
      if (s.job_count) setStatsJobs(s.job_count);
      if (s.job_count > 0) {
        api.getJobs("?exclude_ignored=false").then(d => {
          if (d.jobs.length) {
            setAllResults(d.jobs);
            const counts = computeStatusCounts(d.jobs);
            setStatusCounts(counts);
            if (d.jobs.some(j => j.score !== undefined)) {
              setFilteredResults(applyFilter(d.jobs, "all"));
              setMatches(String(d.jobs.length));
              setTopScore(d.jobs[0]?.score ? d.jobs[0].score + "%" : "—");
            }
          }
        });
      }
    });
  }, []);

  const handleFilter = (f: string) => {
    setActiveFilter(f);
    setFilteredResults(applyFilter(allResults, f));
  };

  const handleUploadResume = async () => {
    if (!resumeFile) return;
    setLoading("resume");
    try {
      const d = await api.uploadResume(resumeFile);
      setMessage({ type: "success", text: d.message });
      setResumeName(resumeFile.name);
    } catch (e: any) { setMessage({ type: "error", text: e.message }); }
    setLoading(null);
  };

  const handleUploadJobs = async () => {
    if (!jobFiles.length) return;
    setLoading("jobs");
    try {
      const d = await api.uploadJobs(jobFiles);
      let msg = d.message;
      if (d.warnings?.length) msg += " | " + d.warnings.join(" | ");
      setMessage({ type: d.warnings?.length ? "error" : "success", text: msg });
      setStatsJobs(d.job_count);
      const jd = await api.getJobs("?exclude_ignored=false");
      setAllResults(jd.jobs);
      const counts = computeStatusCounts(jd.jobs);
      setStatusCounts(counts);
      setFilteredResults(applyFilter(jd.jobs, activeFilter));
      setMatches(String(jd.jobs.length));
      if (resumeName) {
        setMessage({ type: "info", text: "Auto-scoring new jobs..." });
        setLoading("match");
        const md = await api.runMatch("unscored");
        setAllResults(md.results);
        const mc = computeStatusCounts(md.results);
        setStatusCounts(mc);
        setFilteredResults(applyFilter(md.results, activeFilter));
        setTopScore(md.results.length ? md.results[0]?.score + "%" : "—");
        setMessage(null);
      }
    } catch (e: any) { setMessage({ type: "error", text: e.message }); }
    setLoading(null);
  };

  const handleMatch = async (scope?: string) => {
    setLoading("match"); setShowScorePopup(false);
    try {
      const d = await api.runMatch(scope || scoreScope);
      setAllResults(d.results);
      const counts = computeStatusCounts(d.results);
      setStatusCounts(counts);
      setFilteredResults(applyFilter(d.results, activeFilter));
      setMatches(String(d.results.length));
      setTopScore(d.results.length ? d.results[0]?.score + "%" : "—");
    } catch (e: any) { alert(e.message); }
    setLoading(null);
  };

  const handleClear = async () => {
    await api.clearAll();
    setResumeFile(null); setJobFiles([]); setResumeName(""); setAllResults([]); setFilteredResults([]);
    setStatsJobs(0); setStatusCounts({}); setMatches(""); setTopScore(""); setMessage(null); setDetailJob(null);
  };

  const handleStatus = async (id: string, status: string) => {
    await api.updateStatus(id, status);
    const updated = allResults.map(j => j.id === id ? { ...j, status, status_updated_at: new Date().toISOString() } : j);
    setAllResults(updated);
    setFilteredResults(applyFilter(updated, activeFilter));
    setStatusCounts(computeStatusCounts(updated));
    if (detailJob && detailJob.idx !== undefined) {
      const found = updated[allResults.findIndex(j => j.id === id)];
      if (found) setDetailJob({ job: found, idx: allResults.indexOf(found) });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job?")) return;
    const idx = allResults.findIndex(j => j.id === id);
    if (idx === -1) return;
    await api.deleteJob(idx);
    const updated = allResults.filter(j => j.id !== id);
    setAllResults(updated);
    setFilteredResults(applyFilter(updated, activeFilter));
    setStatusCounts(computeStatusCounts(updated));
    if (detailJob && detailJob.job.id === id) setDetailJob(null);
  };

  const handleDeleteAll = async () => {
    if (!confirm("Delete all jobs? Resume will be kept.")) return;
    await api.deleteAllJobs();
    setAllResults([]); setFilteredResults([]); setStatsJobs(0); setStatusCounts({}); setMatches(""); setTopScore("");
  };

  return (
    <div className="space-y-4">
      {/* Compact stats row */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-[#7c6e60]">Resume: <b className="text-[#1c1917]">{resumeName || "—"}</b></span>
        <span className="text-[#7c6e60]">Jobs: <b className="text-[#1c1917]">{statsJobs}</b></span>
        {matches && <span className="text-[#7c6e60]">Matches: <b className="text-[#1c1917]">{matches}</b></span>}
        {topScore && topScore !== "—" && <span className="text-[#7c6e60]">Top Score: <b className="text-amber-700">{topScore}</b></span>}
        <div className="ml-auto flex gap-2">
          {filteredResults.length > 0 && (
            <button onClick={handleDeleteAll} className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1"><Trash2 size={12} /> Delete All Jobs</button>
          )}
        </div>
      </div>

      {/* Upload row — side by side, very compact */}
      <div className="flex gap-3">
        {/* Resume */}
        <div
          className={cn("flex items-center gap-2 px-3 py-2 border rounded-lg flex-1 transition-all cursor-pointer", resumeFile ? "border-emerald-200 bg-emerald-50/50" : "border-[#ede3da] hover:border-amber-200")}
          onClick={() => document.getElementById("rfile")?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-amber-300"); }}
          onDragLeave={e => e.currentTarget.classList.remove("border-amber-300")}
          onDrop={e => {
            e.preventDefault(); e.currentTarget.classList.remove("border-amber-300");
            const f = e.dataTransfer.files[0];
            if (f?.type === "application/pdf" || f?.name.endsWith(".docx")) { setResumeFile(f); setMessage(null); }
          }}
        >
          <input type="file" id="rfile" accept=".pdf,.docx" className="hidden" onChange={e => { if (e.target.files?.[0]) { setResumeFile(e.target.files[0]); setMessage(null); } }} />
          <FileText size={15} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0 text-[13px] truncate">{resumeFile ? resumeFile.name : "Drop resume PDF/DOCX"}</div>
          <button disabled={!resumeFile || loading === "resume"} onClick={e => { e.stopPropagation(); handleUploadResume(); }}
            className="shrink-0 px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-40 transition-colors">
            {loading === "resume" ? "..." : resumeName ? "Re-upload" : "Upload"}
          </button>
        </div>

        {/* Jobs */}
        <div
          className={cn("flex items-center gap-2 px-3 py-2 border rounded-lg flex-1 transition-all cursor-pointer", jobFiles.length ? "border-emerald-200 bg-emerald-50/50" : "border-[#ede3da] hover:border-amber-200")}
          onClick={() => document.getElementById("jfiles")?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-amber-300"); }}
          onDragLeave={e => e.currentTarget.classList.remove("border-amber-300")}
          onDrop={e => {
            e.preventDefault(); e.currentTarget.classList.remove("border-amber-300");
            const files = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf" || f.name.endsWith(".docx"));
            if (files.length) { setJobFiles(files); setMessage(null); }
          }}
        >
          <input type="file" id="jfiles" accept=".pdf,.docx" multiple className="hidden" onChange={e => { if (e.target.files?.length) { setJobFiles(Array.from(e.target.files)); setMessage(null); } }} />
          <Upload size={15} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0 text-[13px] truncate">{jobFiles.length ? `${jobFiles.length} job file(s)` : "Drop job listings PDF/DOCX"}</div>
          <button disabled={!jobFiles.length || loading === "jobs"} onClick={e => { e.stopPropagation(); handleUploadJobs(); }}
            className="shrink-0 px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-40 transition-colors">
            {loading === "jobs" ? "Parsing..." : "Upload & Parse"}
          </button>
        </div>

        {/* Score Again button */}
        {statsJobs > 0 && resumeName && (
          <div className="relative">
            <button disabled={loading === "match"} onClick={() => setShowScorePopup(!showScorePopup)}
              className="shrink-0 px-4 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-30 transition-colors flex items-center gap-1.5">
              <RefreshCw size={14} className={loading === "match" ? "animate-spin" : ""} /> {loading === "match" ? "Scoring..." : "Score Again"}
            </button>
            {showScorePopup && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-[#ede3da] rounded-lg shadow-lg z-30 p-3 w-72">
                <p className="text-[11px] font-semibold text-[#7c6e60] mb-2">Choose which jobs to re-score:</p>
                <div className="space-y-1.5">
                  {[
                    { key: "unscored", label: "New (unscored)", count: allResults.filter(j => j.score === undefined && j.status !== "duplicate" && j.status !== "ignored").length },
                    { key: "new", label: "New status jobs", count: statusCounts.new },
                    { key: "ignored", label: "Ignored jobs", count: statusCounts.ignored },
                    { key: "all", label: "All jobs (reset)", count: allResults.filter(j => j.status !== "duplicate").length },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => { setScoreScope(opt.key); handleMatch(opt.key); }}
                      disabled={opt.count === 0 || loading === "match"}
                      className="w-full text-left px-2.5 py-1.5 rounded-md text-xs hover:bg-amber-50 disabled:opacity-30 flex items-center justify-between">
                      <span>{opt.label}</span>
                      <span className="font-semibold text-[#7c6e60]">{opt.count}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowScorePopup(false)} className="mt-2 text-[10px] text-stone-400 hover:text-stone-600">Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={cn("text-xs px-3 py-2 rounded-md", message.type === "error" ? "bg-red-50 text-red-700 border border-red-200" : message.type === "info" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200")}>
          {message.text}
        </div>
      )}

      {/* Status tabs */}
      {allResults.length > 0 && (
        <div className="flex gap-1 flex-wrap items-center">
          {Object.entries({ all: "All", new: "New", email_sent: "Emailed", waiting_reply: "Waiting", interviewing: "Interview", offer_received: "Offered", duplicate: "Duplicate", ignored: "Ignored" })
            .map(([k, label]) => (
              <button key={k} onClick={() => handleFilter(k)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1",
                  activeFilter === k ? "bg-amber-600 text-white" : "text-[#7c6e60] hover:bg-[#f5f0eb]"
                )}>
                {label} <span className="opacity-60">{statusCounts[k] || 0}</span>
              </button>
            ))}
          <button onClick={handleClear} className="ml-auto text-[11px] text-stone-400 hover:text-stone-600 flex items-center gap-1"><Trash2 size={11} /> Clear</button>
        </div>
      )}

      {/* Empty state */}
      {!filteredResults.length && allResults.length === 0 && (
        <div className="text-center py-28 text-[#b8ae9e]">
          <p className="text-sm">Upload your resume and job files, then click <b className="text-amber-700">Find Matches</b>.</p>
        </div>
      )}

      {/* Results — warm Claude-style */}
      {filteredResults.length > 0 && (
        <div className="border border-[#ede3da] rounded-xl overflow-hidden">
          {/* Compact header */}
          <div className="grid grid-cols-[28px_60px_1fr_1fr_100px_1.2fr_100px_32px] gap-2 px-3 py-2 bg-[#faf7f5] border-b border-[#ede3da] text-[10px] font-semibold uppercase tracking-wider text-[#b8ae9e]">
            <div className="text-center">#</div><div>Score</div><div>Company</div><div>Title</div><div>Status</div><div>Email</div><div>Info</div><div></div>
          </div>
          {filteredResults.map((job, idx) => {
            const sc = job.score || 0;
            const st = job.status || "new";
            return (
              <div key={job.id} onClick={() => setDetailJob({ job })}
                className={cn("grid grid-cols-[28px_60px_1fr_1fr_100px_1.2fr_100px_32px] gap-2 px-3 py-2 border-b border-[#f5f0eb] last:border-0 items-center cursor-pointer hover:bg-amber-50/60 text-[13px] transition-colors", detailJob?.job.id === job.id && "bg-amber-50")}>
                <div className="text-center text-[#b8ae9e] text-xs font-medium">{idx + 1}</div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("font-bold text-xs w-7 text-right tabular-nums", getScoreColor(sc))}>{sc}%</span>
                  <div className="w-8 h-1 rounded-full bg-[#f5f0eb] overflow-hidden">
                    <div className={cn("h-full rounded-full", getScoreBg(sc))} style={{ width: `${Math.min(sc, 100)}%` }} />
                  </div>
                </div>
                <div className="font-semibold text-[#1c1917] truncate">{job.company || "—"}</div>
                <div className="text-amber-700 truncate">{job.title || "—"}</div>
                <div className="relative group">
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-default", `bg-opacity-15`, "border")}
                    style={{ backgroundColor: "var(--tw-ring-color)", borderColor: "transparent" }}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[st])} /> {STATUS_LABELS[st]}
                  </span>
                  {/* Status dropdown on hover */}
                  <div className="hidden group-hover:block absolute top-full left-0 mt-1 bg-white border border-[#ede3da] rounded-lg shadow-lg z-20 py-1 min-w-[130px]">
                    {["new","email_sent","waiting_reply","interviewing","offer_received","ignored"].map(s => (
                      <button key={s} onClick={e => { e.stopPropagation(); handleStatus(job.id, s); }}
                        className={cn("w-full text-left px-3 py-1.5 text-xs hover:bg-[#f5f0eb]", st === s && "font-semibold text-amber-700")}>
                        <span className={cn("w-1.5 h-1.5 rounded-full inline-block mr-1.5 align-middle", STATUS_DOT[s])} /> {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="truncate">
                  {job.email ? <a href={`mailto:${job.email}`} onClick={e => e.stopPropagation()} className="text-amber-700 hover:underline text-xs">{job.email}</a> : <span className="text-xs text-stone-300">—</span>}
                </div>
                <div className="text-xs text-[#b8ae9e] truncate">{[job.location, job.experience].filter(Boolean).join(" · ") || "—"}</div>
                <button onClick={e => { e.stopPropagation(); handleDelete(job.id); }} className="flex items-center justify-center w-5 h-5 rounded text-stone-300 hover:text-red-500 hover:bg-red-50 text-xs">✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail slide-over */}
      {detailJob && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setDetailJob(null)} />
          <div className="w-[440px] bg-[#fffdfa] shadow-2xl border-l border-[#ede3da] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede3da]">
              <div>
                <h2 className="text-base font-bold text-[#1c1917]">{detailJob.job.company || "Unknown"}</h2>
                <p className="text-sm text-amber-700">{detailJob.job.title}</p>
              </div>
              <button onClick={() => setDetailJob(null)} className="p-1.5 rounded-lg hover:bg-[#f5f0eb] text-stone-400 hover:text-stone-700"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
                {detailJob.job.email && <span className="flex items-center gap-1.5 text-[#7c6e60]"><Mail size={13} /> <a href={`mailto:${detailJob.job.email}`} className="text-amber-700 hover:underline">{detailJob.job.email}</a></span>}
                {detailJob.job.location && <span className="flex items-center gap-1.5 text-[#7c6e60]"><MapPin size={13} /> {detailJob.job.location}</span>}
                {detailJob.job.experience && <span className="flex items-center gap-1.5 text-[#7c6e60]"><Clock size={13} /> {detailJob.job.experience}</span>}
              </div>

              <div className={cn("inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold", (detailJob.job.score || 0) >= 60 ? "bg-emerald-50 text-emerald-800" : (detailJob.job.score || 0) >= 30 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800")}>
                Match: {detailJob.job.score || 0}% · {detailJob.job.scoring_method || "llm"}
              </div>

              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[#b8ae9e] text-xs uppercase font-semibold">Status</span>
                <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border", "bg-opacity-15")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[detailJob.job.status || "new"])} /> {STATUS_LABELS[detailJob.job.status || "new"]}
                </span>
              </div>

              {[detailJob.job.created_at, detailJob.job.email_sent_at, detailJob.job.status_updated_at].some(Boolean) && (
                <div className="text-[11px] text-[#b8ae9e] space-y-0.5">
                  {detailJob.job.created_at && <div>Added: {formatDate(detailJob.job.created_at)}</div>}
                  {detailJob.job.email_sent_at && <div>Emailed: {formatDate(detailJob.job.email_sent_at)}</div>}
                  {detailJob.job.status_updated_at && <div>Status: {formatDate(detailJob.job.status_updated_at)}</div>}
                </div>
              )}
              {detailJob.job.strengths && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase text-[#b8ae9e] mb-1">Strengths</h4>
                  <p className="text-[13px] text-emerald-700 leading-relaxed">{detailJob.job.strengths}</p>
                </div>
              )}
              {detailJob.job.gaps && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase text-[#b8ae9e] mb-1">Gaps</h4>
                  <p className="text-[13px] text-red-600 leading-relaxed">{detailJob.job.gaps}</p>
                </div>
              )}
              <div>
                <h4 className="text-[11px] font-semibold uppercase text-[#b8ae9e] mb-1">Description</h4>
                <p className="text-[13px] text-[#1c1917] leading-relaxed whitespace-pre-wrap">{detailJob.job.description || "No description"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
