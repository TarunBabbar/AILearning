import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import type { Job } from "@/lib/types";
import { isCompanyEmail, isValidJobTitle, normalizeJobTitle, isGenericEmail, getScoreColor, cn, formatDate } from "@/lib/utils";
import { Send, ShieldCheck, Mail, FileText, CheckCircle, Loader2, ChevronDown, ChevronRight, Ban, X, Square, MapPin, Clock } from "lucide-react";

const IGNORED_TEMPLATE = `Dear Hiring Team,

I am writing to express my interest in QA/Test Automation opportunities at your organization. With over 18 years of experience in quality engineering and test automation leadership, I believe my background can bring significant value to your team.

A few highlights:

<b>Generative AI in Testing:</b> Hands-on experience designing RAG-based test intelligence pipelines and MCP integrations connecting LLMs with automation frameworks.

<b>Automation Frameworks:</b> 18+ years building and scaling automation solutions using Selenium WebDriver and Playwright.

<b>Leadership:</b> Led and mentored QA teams of 6+ engineers, driving 100% automation adoption and reducing production defects by ~40%.

<b>Innovation:</b> Architected multi-agent QA workflows for intelligent defect triage and root cause analysis.

I am based in Pune and available to discuss how my experience can contribute to your team.

Thank you for your time and consideration.

Best regards,
Tarun Kumar Babbar
+91-9623252365 · babbartarunkumar@gmail.com · linkedin.com/in/tarunbabbar
Pune, India`;

export default function IgnoredEmailAgent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [gmailUser, setGmailUser] = useState(localStorage.getItem("agent_gmail_user") || "");
  const [gmailPass, setGmailPass] = useState(localStorage.getItem("agent_gmail_pass") || "");
  const [verified, setVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const stopRef = useRef(false);
  const [sendingIdx, setSendingIdx] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [subject, setSubject] = useState("Application - QA Test Automation / AI-Augmented Testing Leader");
  const [template, setTemplate] = useState(IGNORED_TEMPLATE);
  const [logs, setLogs] = useState<{ text: string; type: string }[]>([]);
  const [resumeStatus, setResumeStatus] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);

  const ignoredJobs = jobs.filter(j => {
    if (j.status === "deleted") return false;
    if (j.email_sent) return false;
    if (j.status === "ignored") return true;
    if (!j.email) return false;
    if (!j.company || j.company === "Unknown Company") return true;
    if (!isCompanyEmail(j.email, j.company)) return true;
    if (!isValidJobTitle(j.title)) return true;
    return false;
  }).filter(j => j.email && !isGenericEmail(j.email));

  useEffect(() => { api.getJobs("?exclude_ignored=false").then(d => setJobs(d.jobs)); }, []);

  const log = (text: string, type = "info") => setLogs(prev => [...prev, { text, type }]);
  const handleVerify = async () => {
    try { await api.verifyGmail(gmailUser, gmailPass); setVerified(true); localStorage.setItem("agent_gmail_user", gmailUser); localStorage.setItem("agent_gmail_pass", gmailPass); log("✅ Gmail authenticated", "ok"); }
    catch (e: any) { setVerified(false); log("❌ Auth failed: " + e.message, "err"); }
  };
  const handleUploadResume = async () => {
    const input = document.getElementById("resumeFileInputIgnored") as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    try { const d = await api.uploadResume(file); setResumeStatus("✅ " + d.message); log("📎 Resume saved", "ok"); }
    catch (e: any) { setResumeStatus("❌ " + e.message); }
  };
  const sendOne = async (job: Job) => {
    if (!job?.email || job.email_sent) return;
    setSendingIdx(job.id);
    try {
      await api.sendEmail(job.id, gmailUser, gmailPass, subject, template);
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, email_sent: true } : j));
      log(`✅ ${job.company || "Unknown"}`, "ok");
    } catch (e: any) { log(`❌ ${job.email}: ${e.message}`, "err"); }
    setSendingIdx(null);
  };
  const handleSendAll = async () => {
    setSending(true); stopRef.current = false; setLogs([]);
    log(`▶ Sending to ${ignoredJobs.length} contacts`, "info");
    let success = 0, failed = 0;
    for (const job of ignoredJobs) {
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
        <h2 className="font-bold text-[#1c1917] flex items-center gap-2"><Ban size={18} className="text-stone-500" /> Improper Extraction</h2>
        <div className="flex gap-3 text-[13px] text-[#7c6e60] ml-2"><span className="font-semibold text-stone-600">{ignoredJobs.length} with email</span></div>
        <div className="ml-auto flex gap-2">
          {ignoredJobs.length > 0 && (
            <button disabled={!verified || sending} onClick={handleSendAll} className="px-4 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-30 transition-colors flex items-center gap-1.5">
              {sending ? <><Loader2 size={12} className="animate-spin" /> Sending...</> : <><Send size={12} /> Send All ({ignoredJobs.length})</>}
            </button>
          )}
          {sending && (
            <button onClick={stopSending} className="px-4 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5"><Square size={12} /> Stop</button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 py-2.5 border-b border-[#ede3da]">
        <FileText size={14} className="text-stone-400 shrink-0" /><input type="file" id="resumeFileInputIgnored" accept=".pdf,.docx" className="text-[11px] w-28" />
        <button onClick={handleUploadResume} className="px-2 py-1 text-[11px] bg-[#f5f0eb] rounded hover:bg-[#ede3da] shrink-0">Upload</button>
        {resumeStatus && <span className="text-[10px] text-emerald-600 truncate max-w-32">{resumeStatus}</span>}
        <span className="text-stone-300">|</span><ShieldCheck size={14} className="text-stone-400 shrink-0" />
        <input type="email" value={gmailUser} onChange={e => setGmailUser(e.target.value)} placeholder="you@gmail.com" className="w-36 px-2 py-1 text-[11px] border border-[#ede3da] rounded outline-none focus:border-amber-300" />
        <input type="password" value={gmailPass} onChange={e => setGmailPass(e.target.value)} placeholder="App password" className="w-32 px-2 py-1 text-[11px] border border-[#ede3da] rounded outline-none focus:border-amber-300" />
        <button onClick={handleVerify} className={cn("px-2.5 py-1 text-[11px] font-medium rounded shrink-0", verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-600 text-white hover:bg-amber-700")}>{verified ? <><CheckCircle size={12} className="inline mr-1" /> OK</> : "Verify"}</button>
        <button onClick={() => setShowTemplate(!showTemplate)} className="ml-auto text-[11px] text-[#7c6e60] hover:text-amber-700 flex items-center gap-1">{showTemplate ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Template</button>
      </div>
      {showTemplate && (
        <div className="py-2.5 border-b border-[#ede3da] space-y-2">
          <div className="flex items-center gap-2"><input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="flex-1 px-2.5 py-1.5 text-xs border border-[#ede3da] rounded-md outline-none focus:border-amber-300" /><span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Fixed — no placeholders</span></div>
          <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={10} className="w-full px-2.5 py-2 text-xs border border-[#ede3da] rounded-md outline-none focus:border-amber-300 font-mono resize-y" />
          <p className="text-[10px] text-[#b8ae9e]">No {"{{company}} or {{title}}"} placeholders — these jobs have missing data</p>
        </div>
      )}
      <div className="flex gap-4 flex-1 overflow-hidden pt-3">
        <div className="flex-1 flex flex-col min-w-0">
          {ignoredJobs.length > 0 ? (
            <div className="border border-stone-200 rounded-xl overflow-hidden bg-white flex-1">
              <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-[11px] font-semibold text-stone-700">Improper Extraction — with Email ({ignoredJobs.length})</div>
              <div className="flex items-center gap-2 px-3 py-1 bg-stone-50/50 border-b border-stone-100 text-[10px] font-semibold uppercase text-stone-400">
                <span className="w-10 shrink-0">Score</span><span className="w-[130px] shrink-0">Company</span><span className="flex-1">Email</span>
              </div>
              <div className="overflow-y-auto flex-1">
                {ignoredJobs.map((j) => {
                  const isSending = sendingIdx === j.id;
                  return (
                    <div key={j.id} onClick={() => setDetailJob(j)} className="flex items-center gap-2 px-3 py-2 border-b border-[#f5f0eb] last:border-0 hover:bg-stone-50/50 transition-colors group cursor-pointer">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        {j.score !== undefined ? <span className={cn("text-[10px] font-bold w-8 text-right shrink-0 tabular-nums", getScoreColor(j.score))}>{j.score}%</span> : <span className="w-8 shrink-0" />}
                        <span className="text-[13px] font-semibold text-[#1c1917] truncate w-[130px] shrink-0">{j.company || "Unknown"}</span>
                        <span className="text-[11px] text-[#b8ae9e] truncate">{j.email}</span>
                      </div>
                      <button disabled={!verified || isSending || sending} onClick={e => { e.stopPropagation(); sendOne(j); }} className="shrink-0 px-2.5 py-1 text-[10px] font-medium rounded border border-stone-200 text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-stone-50 disabled:opacity-0">{isSending ? <Loader2 size={10} className="animate-spin" /> : j.email_sent ? "Done" : "Send"}</button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(j.id); }} className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-stone-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 text-[10px]"><X size={10} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (<div className="flex-1 flex items-center justify-center text-[13px] text-[#b8ae9e]">No ignored jobs with email addresses.</div>)}
        </div>
        <div className="w-[300px] shrink-0">
          <div className="border border-[#ede3da] rounded-xl bg-white overflow-hidden flex flex-col h-full">
            <div className="px-3 py-2 bg-[#faf7f5] border-b border-[#ede3da] text-[11px] font-semibold text-[#7c6e60]">Activity ({logs.length})</div>
            <div className="overflow-y-auto flex-1">{logs.length > 0 ? logs.slice().reverse().map((l, i) => (<div key={i} className={cn("px-3 py-1.5 border-b border-[#f5f0eb] last:border-0 text-[11px]", l.type === "ok" ? "text-emerald-700" : l.type === "err" ? "text-red-600" : "text-[#7c6e60]")}>{l.text}</div>)) : <div className="px-3 py-6 text-[11px] text-[#b8ae9e] text-center">No activity yet</div>}</div>
          </div>
        </div>
      </div>
      {detailJob && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/20" onClick={() => setDetailJob(null)} />
          <div className="w-[440px] bg-[#fffdfa] shadow-2xl border-l border-[#ede3da] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede3da]">
              <div><h2 className="text-base font-bold text-[#1c1917]">{detailJob.company || "Unknown"}</h2><p className="text-sm text-stone-500">{detailJob.title || "No title"}</p></div>
              <button onClick={() => setDetailJob(null)} className="p-1.5 rounded-lg hover:bg-[#f5f0eb] text-stone-400 hover:text-stone-700"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
                {detailJob.email && <span className="flex items-center gap-1.5 text-[#7c6e60]"><Mail size={13} /><a href={`mailto:${detailJob.email}`} className="text-amber-700 hover:underline">{detailJob.email}</a></span>}
                {detailJob.location && <span className="flex items-center gap-1.5 text-[#7c6e60]"><MapPin size={13} />{detailJob.location}</span>}
                {detailJob.experience && <span className="flex items-center gap-1.5 text-[#7c6e60]"><Clock size={13} />{detailJob.experience}</span>}
              </div>
              {detailJob.score !== undefined && <div className={cn("inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold", (detailJob.score || 0) >= 60 ? "bg-emerald-50 text-emerald-800" : (detailJob.score || 0) >= 30 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800")}>Match: {detailJob.score}% · llm</div>}
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
