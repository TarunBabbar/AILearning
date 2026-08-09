"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Loader2, Sparkles, ArrowRight, Briefcase, Mail, Building2 } from "lucide-react";
import Link from "next/link";
import { runScoreWave, type ScoreProgress } from "@/lib/score-wave";
import { ScoreLivePanel } from "@/components/ui/ScoreLivePanel";
import PageChrome from "@/components/ui/PageChrome";
import Button from "@/components/ui/Button";
import { invalidateListCaches } from "@/lib/use-list-swr";

export default function ResumePage() {
  const router = useRouter();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeMeta, setResumeMeta] = useState<{ filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [progress, setProgress] = useState<ScoreProgress | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/resume")
      .then((r) => r.json())
      .then((d) => { if (d.resume) setResumeMeta({ filename: d.resume.filename }); })
      .catch(() => setMessage("Could not load resume status"));
  }, []);

  const handleResumeUpload = async () => {
    if (!resumeFile) return;
    setUploading(true); setMessage("");
    const form = new FormData(); form.append("resume", resumeFile);
    try {
      const res = await fetch("/api/resume", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMessage(`Resume uploaded: ${data.filename}`);
      setResumeMeta({ filename: data.filename }); setResumeFile(null);
      await invalidateListCaches();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed"); }
    finally { setUploading(false); }
  };

  const handleScore = async () => {
    setScoring(true); setMessage("");
    setProgress({ percent: 1, completed: 0, attempted: 0, scored: 0, strongMatches: 0, message: "Starting…", ticker: "Parsing job descriptions…" });
    try {
      const result = await runScoreWave({ scope: "unscored", onProgress: setProgress });
      if (!result.ok) setMessage(`Error: ${result.error || result.message}`);
      else { setMessage(result.strongMatches > 0 ? `Found ${result.strongMatches} strong matches this wave.` : "Wave finished — no new strong matches this round."); if (result.strongMatches > 0) router.push("/resume/matches"); }
      await invalidateListCaches();
    } catch { setMessage("Scoring failed"); }
    finally { setScoring(false); }
  };

  const links = [
    { href: "/resume/matches", label: "Matches", icon: Briefcase, text: "Review fit scores, strengths, gaps, and pipeline status." },
    { href: "/resume/email", label: "Email Agent", icon: Mail, text: "Prepare and send tailored applications." },
    { href: "/resume/companies", label: "Companies", icon: Building2, text: "Explore companies behind your strongest roles." },
  ];

  return (
    <PageChrome maxWidthClass="max-w-5xl" header={<div><h1 className="text-lg font-semibold tracking-tight text-text-primary">Resume & Job Matcher</h1><p className="mt-1 text-sm text-text-muted">Upload your resume, score open roles, and manage your application pipeline.</p></div>}>
      <div className="space-y-4 pb-8">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm md:col-span-2">
            <div className="mb-3 flex items-center gap-2"><FileText size={18} className="text-amber-500" /><h2 className="font-semibold text-text-primary">Upload resume</h2></div>
            {resumeMeta && <p className="mb-3 text-sm text-text-muted">Current: <span className="font-medium text-text-primary">{resumeMeta.filename}</span></p>}
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-border bg-bg-page p-5 transition-colors hover:border-amber-500/50 hover:bg-accent-soft/30"><Upload size={24} className="shrink-0 text-text-muted" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-text-primary">{resumeFile ? resumeFile.name : "Choose a resume file"}</p><p className="mt-1 text-xs text-text-muted">PDF, DOCX, TXT, or Markdown</p></div><input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} className="hidden" /></label>
            {resumeFile && <Button onClick={handleResumeUpload} disabled={uploading} className="mt-3">{uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Upload resume</Button>}
          </div>
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Next step</p><p className="mt-2 text-lg font-semibold text-text-primary">Score your fit</p><p className="mt-1 text-sm leading-relaxed text-text-muted">Compare your profile with open roles using multiple free AI models.</p><Button onClick={handleScore} disabled={scoring || !resumeMeta} className="mt-4 w-full">{scoring ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{scoring ? "Scoring…" : "Score next wave"}</Button>{!resumeMeta && <p className="mt-2 text-xs text-amber-700">Upload a resume first.</p>}</div>
        </div>
        {scoring && progress && <ScoreLivePanel progress={progress} />}
        {message && !scoring && <div className="rounded-lg border border-border bg-white p-3 text-sm text-text-secondary">{message}</div>}
        <div className="grid gap-3 md:grid-cols-3">{links.map(({ href, label, icon: Icon, text }) => <Link key={href} href={href} className="group rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-500/30 hover:shadow-md"><div className="mb-3 flex items-center justify-between"><span className="rounded-lg bg-accent-soft p-2 text-accent-strong"><Icon size={18} /></span><ArrowRight size={16} className="text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-amber-600" /></div><h3 className="font-semibold text-text-primary">{label}</h3><p className="mt-1 text-sm leading-relaxed text-text-muted">{text}</p></Link>)}</div>
      </div>
    </PageChrome>
  );
}
