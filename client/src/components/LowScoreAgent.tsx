import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Job } from "@/lib/types";
import { isCompanyEmail, isValidJobTitle, normalizeJobTitle, getScoreColor, cn, formatDate } from "@/lib/utils";
import { Send, ShieldCheck, Mail, FileText, CheckCircle, Loader2, ChevronDown, ChevronRight, TrendingDown, X, Square, MapPin, Clock } from "lucide-react";

const DEFAULT_TEMPLATE = `Dear Team,

I am writing to express my interest in the {{title}} position at {{company}}. With over 18 years of experience in quality engineering and test automation leadership, I believe my background aligns closely with what you are looking for.

A few highlights relevant to this role:

<b>Generative AI in Testing:</b> Hands-on experience designing RAG-based test intelligence pipelines and MCP integrations connecting LLMs with automation frameworks.

<b>Automation Frameworks:</b> 18+ years building and scaling automation solutions using Selenium WebDriver and Playwright.

<b>Leadership & Mentoring:</b> Led and mentored QA teams of 6+ engineers, driving 100% automation adoption and reducing production defects by ~40%.

<b>Innovation & POCs:</b> Agentic QA workflows for intelligent defect triage and root cause analysis.

I am based in Pune and available to discuss how my experience can contribute to your team.

Thank you for your time and consideration.

Best regards,
Tarun Kumar Babbar
+91-9623252365
babbartarunkumar@gmail.com
linkedin.com/in/tarunbabbar
Pune, India`;

export default function LowScoreAgent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [gmailUser, setGmailUser] = useState(localStorage.getItem("agent_gmail_user") || "");
  const [gmailPass, setGmailPass] = useState(localStorage.getItem("agent_gmail_pass") || "");
  const [verified, setVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const stopRef = useRef(false);
  const [sendingIdx, setSendingIdx] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [subject, setSubject] = useState("Application for {{title}} at {{company}}");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [logs, setLogs] = useState<{ text: string; type: string }[]>([]);
  const [resumeStatus, setResumeStatus] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);
  const [showSent, setShowSent] = useState(true);

  const pendingJobs = jobs.filter(j => isCompanyEmail(j.email, j.company) && isValidJobTitle(j.title) && !j.email_sent && j.score !== undefined && j.score < 60 && j.status !== "deleted");
  const sentJobs = jobs.filter(j => isCompanyEmail(j.email, j.company) && j.email_sent && j.status !== "deleted");
  const hiddenCount = jobs.filter(j => !isCompanyEmail(j.email, j.company) || !isValidJobTitle(j.title)).length;

  useEffect(() => { api.getJobs("?exclude_ignored=false").then(d => setJobs(d.jobs)); }, []);

  const log = (text: string, type = "info") => setLogs(prev => [...prev, { text, type }]);
  const handleVerify = async () => {
    try { await api.verifyGmail(gmailUser, gmailPass); setVerified(true); localStorage.setItem("agent_gmail_user", gmailUser); localStorage.setItem("agent_gmail_pass", gmailPass); log("✅ Gmail authenticated", "ok"); }
    catch (e: any) { setVerified(false); log("❌ Auth failed: " + e.message, "err"); }
  };
  const handleUploadResume = async () => {
    const input = document.getElementById("resumeFileInputLow") as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    try { const d = await api.uploadResume(file); setResumeStatus("✅ " + d.message); log("📎 Resume saved", "ok"); }
    catch (e: any) { setResumeStatus("❌ " + e.message); }
  };
  const sendOne = async (job: Job) => {
    if (!job?.email || job.email_sent) return;
    setSendingIdx(job.id);
    const displayTitle = normalizeJobTitle(job.title);
    const company = job.company || "Company";
    try {
      const subj = subject.replace(/\{\{company\}\}/g, company).replace(/\{\{title\}\}/g, displayTitle).replace(/\{\{location\}\}/g, job.location || "");
      const body = template.replace(/\{\{company\}\}/g, company).replace(/\{\{title\}\}/g, displayTitle).replace(/\{\{location\}\}/g, job.location || "");
      await api.sendEmail(job.id, gmailUser, gmailPass, subj, body);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, email_sent: true, status: "email_sent" } : j));
      log(`✅ ${company}`, "ok");
    } catch (e: any) { log(`❌ ${company}: ${e.message}`, "err"); }
    setSendingIdx(null);
  };
  const handleSendAll = async () => {
    setSending(true); stopRef.current = false; setLogs([]);
    log(`▶ Sending to ${pendingJobs.length} emails`, "info");
    let success = 0, failed = 0;
    for (const job of pendingJobs) {
      if (stopRef.current) { log("⏹ Stopped by user", "info"); break; }
      try { await sendOne(job); success++; } catch { failed++; }
    }
    log(`${success} sent, ${failed} failed`, success > 0 ? "ok" : "err");
    setSending(false);
  };
  const stopSending = () => { stopRef.current = true; };
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job?")) return;
    const idx = jobs.findIndex(x => x.id === id);
    if (idx === -1) return;
    await api.deleteJob(idx);
    setJobs(prev => prev.map(x => x.id === id ? { ...x, status: "deleted" } : x));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      <div className="flex items-center gap-4 pb-3 border-b border-[#ede3da]">
        <h2 className="font-bold text-[#1c1917] flex items-center gap-2"><TrendingDown size={18} className="text-orange-500" /> Low Score Agent</h2>
        <div className="flex gap-3 text-[13px] text-[#7c6e60] ml-2">
          <span className="font-semibold text-orange-600">{pendingJobs.length} pending</span>
          <span className="text-stone-300">·</span>
          <span className="font-semibold text-emerald-700">{sentJobs.length} sent</span>
          {hiddenCount > 0 && <><span className="text-stone-300">·</span><span className="text-stone-400">{hiddenCount} hidden</span></>}
        </div>
        <div className="ml-auto flex gap-2">
          {pendingJobs.length > 0 && (
            <button disabled={!verified || sending} onClick={handleSendAll}
              className="px-4 py-1.5 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-30 transition-colors flex items-center gap-1.5">
              {sending ? <><Loader2 size={12} className="animate-spin" /> Sending...</> : <><Send size={12} /> Send All ({pendingJobs.length})</>}
            </button>
          )}
          {sending && (
            <button onClick={stopSending} className="px-4 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5"><Square size={12} /> Stop</button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 py-2.5 border-b border-[#ede3da]">
        <FileText size={14} className="text-stone-400 shrink-0" />
        <input type="file" id="resumeFileInputLow" accept=".pdf,.docx" className="text-[11px] w-28" />
        <button onClick={handleUploadResume} className="px-2 py-1 text-[11px] bg-[#f5f0eb] rounded hover:bg-[#ede3da] shrink-0">Upload</button>
        {resumeStatus && <span className="text-[10px] text-emerald-600 truncate max-w-32">{resumeStatus}</span>}
        <span className="text-stone-300">|</span>
        <ShieldCheck size={14} className="text-stone-400 shrink-0" />
        <input type="email" value={gmailUser} onChange={e => setGmailUser(e.target.value)} placeholder="you@gmail.com" className="w-36 px-2 py-1 text-[11px] border border-[#ede3da] rounded outline-none focus:border-amber-300" />
        <input type="password" value={gmailPass} onChange={e => setGmailPass(e.target.value)} placeholder="App password" className="w-32 px-2 py-1 text-[11px] border border-[#ede3da] rounded outline-none focus:border-amber-300" />
        <button onClick={handleVerify} className={cn("px-2.5 py-1 text-[11px] font-medium rounded shrink-0", verified ? "bg-emerald-100 text-emerald-700" : "bg-orange-500 text-white hover:bg-orange-600")}>
          {verified ? <><CheckCircle size={12} className="inline mr-1" /> OK</> : "Verify"}
        </button>
        <button onClick={() => setShowTemplate(!showTemplate)} className="ml-auto text-[11px] text-[#7c6e60] hover:text-orange-500 flex items-center gap-1">
          {showTemplate ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Template
        </button>
      </div>
      {showTemplate && (
        <div className="py-2.5 border-b border-[#ede3da] space-y-2">
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border border-[#ede3da] rounded-md outline-none focus:border-amber-300" />
          <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={8} className="w-full px-2.5 py-2 text-xs border border-[#ede3da] rounded-md outline-none focus:border-amber-300 font-mono resize-y" />
          <p className="text-[10px] text-[#b8ae9e]">{"{{company}} {{title}} {{location}}"}</p>
        </div>
      )}
      <div className="flex gap-4 flex-1 overflow-hidden pt-3">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {pendingJobs.length > 0 ? (
            <div className="border border-orange-200 rounded-xl overflow-hidden bg-white flex-1 min-h-0 flex flex-col">
              <div className="px-3 py-2 bg-orange-50/60 border-b border-orange-100 text-[11px] font-semibold text-orange-700">Pending ({pendingJobs.length})</div>
              <div className="flex items-center gap-2 px-3 py-1 bg-orange-50/30 border-b border-orange-100 text-[10px] font-semibold uppercase text-orange-400">
                <span className="w-10 shrink-0">Score</span><span className="w-[130px] shrink-0">Company</span><span className="w-[180px] shrink-0">Title</span><span className="flex-1">Email</span>
              </div>
              <div className="overflow-y-auto flex-1">
                {pendingJobs.map((j) => {
                  const isSending = sendingIdx === j.id;
                  return (
                    <div key={j.id} onClick={() => setDetailJob(j)} className="flex items-center gap-2 px-3 py-2 border-b border-[#f5f0eb] last:border-0 hover:bg-orange-50/40 transition-colors group cursor-pointer">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        {j.score !== undefined && <span className={cn("text-[10px] font-bold w-8 text-right shrink-0 tabular-nums", getScoreColor(j.score))}>{j.score}%</span>}
                        <span className="text-[13px] font-semibold text-[#1c1917] truncate w-[130px] shrink-0">{j.company}</span>
                        <span className="text-xs text-orange-600 truncate w-[180px] shrink-0">{j.title}</span>
                        <span className="text-[11px] text-[#b8ae9e] truncate">{j.email}</span>
                      </div>
                      <button disabled={!verified || isSending || sending} onClick={e => { e.stopPropagation(); sendOne(j); }} className="shrink-0 px-2.5 py-1 text-[10px] font-medium rounded border border-orange-200 text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-orange-50 disabled:opacity-0">{isSending ? <Loader2 size={10} className="animate-spin" /> : "Send"}</button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(j.id); }} className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-stone-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 text-[10px]"><X size={10} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (<div className="flex-1 flex items-center justify-center text-[13px] text-[#b8ae9e]">{sentJobs.length > 0 ? "🎉 All emails sent!" : "No low-score pending emails."}</div>)}
        </div>
        <div className="w-[340px] shrink-0 flex flex-col gap-3 overflow-hidden">
          <div className="border border-[#ede3da] rounded-xl bg-white overflow-hidden flex flex-col" style={{ height: "calc(50% - 6px)" }}>
            <div className="px-3 py-2 bg-[#faf7f5] border-b border-[#ede3da] text-[11px] font-semibold text-[#7c6e60] shrink-0">Activity ({logs.length})</div>
            <div className="overflow-y-auto flex-1">{logs.length > 0 ? logs.slice().reverse().map((l, i) => (<div key={i} className={cn("px-3 py-1.5 border-b border-[#f5f0eb] last:border-0 text-[11px]", l.type === "ok" ? "text-emerald-700" : l.type === "err" ? "text-red-600" : "text-[#7c6e60]")}>{l.text}</div>)) : <div className="px-3 py-6 text-[11px] text-[#b8ae9e] text-center">No activity yet</div>}</div>
          </div>
          <div className="border border-emerald-200 rounded-xl bg-white overflow-hidden flex flex-col" style={{ height: "calc(50% - 6px)" }}>
            <button onClick={() => setShowSent(!showSent)} className="w-full px-3 py-2 bg-emerald-50/50 border-b border-emerald-100 text-[11px] font-semibold text-emerald-700 flex items-center justify-between shrink-0"><span>Sent ({sentJobs.length})</span>{showSent ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
            {showSent && (<div className="overflow-y-auto flex-1">{sentJobs.length > 0 ? sentJobs.map((j) => (<div key={j.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-[#f5f0eb] last:border-0"><div className="flex-1 min-w-0"><div className="text-[12px] font-semibold text-[#1c1917] truncate flex items-center gap-2">{j.company}{j.score !== undefined && <span className={cn("text-[10px] font-bold", getScoreColor(j.score))}>{j.score}%</span>}</div><div className="text-[10px] text-[#b8ae9e] truncate">{j.title} · {j.email}</div></div><span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">✓</span></div>)) : <div className="px-3 py-4 text-[11px] text-[#b8ae9e] text-center">Nothing sent yet</div>}</div>)}
          </div>
          {hiddenCount > 0 && <div className="text-[10px] text-stone-400 text-center shrink-0">{hiddenCount} email(s) hidden</div>}
        </div>
      </div>
      {detailJob && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setDetailJob(null)} />
          <div className="w-[440px] bg-[#fffdfa] shadow-2xl border-l border-[#ede3da] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede3da]">
              <div><h2 className="text-base font-bold text-[#1c1917]">{detailJob.company || "Unknown"}</h2><p className="text-sm text-orange-600">{detailJob.title}</p></div>
              <button onClick={() => setDetailJob(null)} className="p-1.5 rounded-lg hover:bg-[#f5f0eb] text-stone-400 hover:text-stone-700"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
                {detailJob.email && <span className="flex items-center gap-1.5 text-[#7c6e60]"><Mail size={13} /><a href={`mailto:${detailJob.email}`} className="text-amber-700 hover:underline">{detailJob.email}</a></span>}
                {detailJob.location && <span className="flex items-center gap-1.5 text-[#7c6e60]"><MapPin size={13} />{detailJob.location}</span>}
                {detailJob.experience && <span className="flex items-center gap-1.5 text-[#7c6e60]"><Clock size={13} />{detailJob.experience}</span>}
              </div>
              <div className={cn("inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold", (detailJob.score || 0) >= 60 ? "bg-emerald-50 text-emerald-800" : (detailJob.score || 0) >= 30 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800")}>Match: {detailJob.score || 0}% · llm</div>
              {detailJob.strengths && <div><h4 className="text-[11px] font-semibold uppercase text-[#b8ae9e] mb-1">Strengths</h4><p className="text-[13px] text-emerald-700 leading-relaxed">{detailJob.strengths}</p></div>}
              {detailJob.gaps && <div><h4 className="text-[11px] font-semibold uppercase text-[#b8ae9e] mb-1">Gaps</h4><p className="text-[13px] text-red-600 leading-relaxed">{detailJob.gaps}</p></div>}
              <div><h4 className="text-[11px] font-semibold uppercase text-[#b8ae9e] mb-1">Description</h4><p className="text-[13px] text-[#1c1917] leading-relaxed whitespace-pre-wrap">{detailJob.description || "No description"}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
