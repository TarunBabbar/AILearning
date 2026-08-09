"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Mail, Send, Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PageChrome from "@/components/ui/PageChrome";
import { JobAvatar } from "@/components/ui/JobAvatar";
import { JobCardSkeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import JobDetailModal from "@/components/ui/JobDetailModal";
import { invalidateListCaches, useListSWR } from "@/lib/use-list-swr";

type Job = { id: string; title: string; company: string; email?: string | null; score?: number | null; emailSent: boolean; emailSentAt?: string | null; location?: string | null };
type JobsResponse = { jobs: Job[]; total: number; pageCount: number };
const DEFAULT_TEMPLATE = "Hi {{company}} team,\n\nI'm applying for the {{title}} position.\n\nKey highlights from my background:\n{{highlights}}\n\nI'd welcome the chance to discuss how I can contribute.\n\nBest regards,\n{{signature}}";

function scoreTone(score?: number | null) { return score != null && score >= 60 ? "bg-[#e3efe3] text-[#3d7a3d]" : "bg-bg-surface text-text-muted"; }

/** Bullets from raw highlights (one per line) — each skill line becomes a bullet. */
function formatHighlights(raw: string): string {
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => `• ${line}`).join("\n");
}

function renderTemplate(template: string, job: Job, highlights: string, signature: string) { return template.replaceAll("{{company}}", job.company).replaceAll("{{title}}", job.title).replaceAll("{{email}}", job.email || "").replaceAll("{{highlights}}", highlights).replaceAll("{{signature}}", signature); }

/** Renders the email body; resume-highlight lines (starting with •) get bold + accent treatment. */
function EmailPreview({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap rounded-lg bg-bg-page p-4 text-sm leading-relaxed text-text-secondary">
      {text.split(/\r?\n/).map((line, i) =>
        line.startsWith("• ") ? (
          <p key={i} className="flex items-start gap-1.5 font-medium text-text-primary">
            <span className="text-amber-600">•</span>
            <span>{line.slice(2)}</span>
          </p>
        ) : (
          <p key={i} className={line.trim() ? "min-h-[1.25rem]" : "h-3"}>{line}</p>
        )
      )}
    </div>
  );
}

export default function EmailAgentPage() {
  const [includeSent, setIncludeSent] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [draftTemplate, setDraftTemplate] = useState(DEFAULT_TEMPLATE);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [totalToSend, setTotalToSend] = useState(0);
  const [signature, setSignature] = useState("QA Candidate");
  const [highlights, setHighlights] = useState("");
  const key = "/api/jobs?view=scored&pageSize=100";
  const { data, error, isLoading, mutate } = useListSWR<JobsResponse>(key);
  const jobs = useMemo(() => (data?.jobs || []).filter((job) => includeSent || !job.emailSent).filter((job) => !!job.email), [data, includeSent]);

  // Load the real resume: highlights (skills / key points) + the person's name for the signature.
  useEffect(() => { fetch("/api/resume").then((r) => r.json()).then((d) => { if (d?.resume?.highlights) setHighlights(formatHighlights(d.resume.highlights)); if (d?.resume?.name) setSignature(d.resume.name); }).catch(() => undefined); }, []);

  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then((d) => { if (d.emailTemplate) { setTemplate(d.emailTemplate); setDraftTemplate(d.emailTemplate); } }).catch(() => undefined); }, []);

  const openTemplate = () => { setDraftTemplate(template); setMessage(""); setTemplateOpen(true); };

  const saveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailTemplate: draftTemplate }) });
      if (res.ok) { setTemplate(draftTemplate); setMessage("Email template saved"); setTemplateOpen(false); }
      else setMessage("Could not save template");
    } finally { setSavingTemplate(false); }
  };

  const sendJobs = async (jobIds: string[]) => {
    if (!jobIds.length) return;
    setSending(true); setSentCount(0); setTotalToSend(jobIds.length); setMessage("");
    try {
      const res = await fetch("/api/jobs/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobIds, template }) });
      const type = res.headers.get("content-type") || "";
      if (type.includes("ndjson") && res.body) {
        const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
        while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) { if (!line.trim()) continue; try { const event = JSON.parse(line); if (event.type === "progress") setSentCount(Number(event.sent || 0)); if (event.type === "done") setMessage(`Sent ${event.sent || 0} application emails.`); } catch { /* skip malformed event */ } } }
      } else { const body = await res.json(); if (!res.ok) setMessage(body.error || "Send failed"); else setMessage(body.message || "Email sent"); }
      await invalidateListCaches(); await mutate();
    } catch { setMessage("Send failed"); } finally { setSending(false); }
  };

  return (
    <PageChrome
      maxWidthClass="max-w-6xl"
      header={<div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Mail size={18} className="text-amber-500" /><h1 className="text-lg font-semibold tracking-tight text-text-primary">Email Agent</h1><span className="rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-strong">{jobs.length} ready</span></div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setIncludeSent(!includeSent)}>{includeSent ? "Hide sent" : "Show sent"}</Button>
          <Button size="sm" variant="ghost" onClick={openTemplate}><Settings2 size={13} />Template</Button>
          <Button size="sm" onClick={() => sendJobs(jobs.filter((j) => !j.emailSent).map((j) => j.id))} disabled={sending || jobs.every((j) => j.emailSent)}>{sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}Send all</Button>
        </div>
      </div>}
    >
      <div className="space-y-4 pb-8">
        {sending && <div className="rounded-xl border border-border bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-sm"><span className="font-medium text-text-primary">Sending applications…</span><span className="text-text-muted">{sentCount}/{totalToSend}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-surface"><div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${totalToSend ? (sentCount / totalToSend) * 100 : 0}%` }} /></div></div>}
        {message && !sending && <div className="rounded-lg border border-border bg-white p-3 text-sm text-text-secondary">{message}</div>}
        {error ? <div className="rounded-xl border border-border bg-white p-12 text-center text-sm text-red-600">Failed to load email jobs.</div> : isLoading && !data ? <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}</div> : jobs.length === 0 ? <div className="rounded-xl border border-border bg-white p-16 text-center"><Mail size={28} className="mx-auto mb-3 text-amber-500" /><p className="font-medium text-text-primary">No jobs ready to email</p><p className="mt-1 text-sm text-text-muted">Score matches first, then send tailored applications here.</p></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{jobs.map((job) => <div key={job.id} className="group rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start gap-3"><JobAvatar name={job.company} /><div className="min-w-0 flex-1"><p className="truncate font-medium text-text-primary">{job.title}</p><p className="truncate text-sm text-text-muted">{job.company}</p><p className="mt-1 truncate text-xs text-text-muted">{job.email}</p></div><span className={cn("rounded-md px-1.5 py-0.5 text-xs font-bold", scoreTone(job.score))}>{job.score ?? "—"}%</span></div><div className="mt-3 flex items-center justify-between"><span className={cn("rounded-full px-2 py-0.5 text-[10px]", job.emailSent ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>{job.emailSent ? `Sent${job.emailSentAt ? ` · ${new Date(job.emailSentAt).toLocaleDateString()}` : ""}` : "Ready"}</span><div className="flex gap-1"><button onClick={() => setSelectedJob(job)} className="rounded-md p-1.5 text-text-muted hover:bg-bg-surface hover:text-text-primary" title="Preview"><Eye size={15} /></button>{!job.emailSent && <button onClick={() => sendJobs([job.id])} disabled={sending} className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"><Send size={12} />Send</button>}</div></div></div>)}</div>}

        {selectedJob && <JobDetailModal open={!!selectedJob} onClose={() => setSelectedJob(null)} title={`Email preview · ${selectedJob.title}`} company={selectedJob.company} subtitle={<span>{selectedJob.email}</span>} sections={[{ label: "Message preview", body: <EmailPreview text={renderTemplate(template, selectedJob, highlights, signature)} /> }]} footer={!selectedJob.emailSent ? <Button onClick={() => { setSelectedJob(null); sendJobs([selectedJob.id]); }}><Send size={14} />Send application</Button> : undefined} />}
      </div>

      {/* Template editor modal */}
      {templateOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => setTemplateOpen(false)}>
          <div className="fade-up flex max-h-[min(90vh,56rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2"><Settings2 size={18} className="text-amber-500" /><h2 className="text-lg font-semibold text-text-primary">Application template</h2></div>
              <button onClick={() => setTemplateOpen(false)} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-surface" title="Close"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <p className="mb-2 text-xs text-text-muted">Placeholders: <code className="rounded bg-bg-surface px-1 py-0.5">{"{{company}}"}</code>, <code className="rounded bg-bg-surface px-1 py-0.5">{"{{title}}"}</code>, <code className="rounded bg-bg-surface px-1 py-0.5">{"{{highlights}}"}</code> (skills from your resume), <code className="rounded bg-bg-surface px-1 py-0.5">{"{{signature}}"}</code> (your name).</p>
              <textarea value={draftTemplate} onChange={(e) => setDraftTemplate(e.target.value)} rows={14} className="w-full resize-y rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm leading-relaxed outline-none focus:border-border-focus" />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border p-4">
              <Button variant="ghost" size="md" onClick={() => setTemplateOpen(false)}>Cancel</Button>
              <Button size="md" onClick={saveTemplate} disabled={savingTemplate}>{savingTemplate && <Loader2 size={15} className="animate-spin" />}Save template</Button>
            </div>
          </div>
        </div>
      )}
    </PageChrome>
  );
}
