import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Job } from "@/lib/types";
import { isCompanyEmail, isValidJobTitle, normalizeJobTitle, cn } from "@/lib/utils";
import { Send, ShieldCheck, Mail, FileText, CheckCircle, Loader2, ChevronDown, ChevronRight, Activity } from "lucide-react";

const DEFAULT_TEMPLATE = `Dear Team,

I am writing to express my interest in the {{title}} position at {{company}}. With over 18 years of experience in quality engineering and test automation leadership, I believe my background aligns closely with what you are looking for.

A few highlights relevant to this role:

<b>Generative AI in Testing:</b> I have hands-on experience designing RAG-based test intelligence pipelines and MCP (Model Context Protocol) integrations that connect LLMs with automation frameworks for context-aware test generation, self-healing locators, and AI-assisted defect analysis — directly aligned with your focus on GenAI-driven test strategy and POCs.

<b>Automation Frameworks:</b> 18+ years building and scaling automation solutions using Selenium WebDriver and Playwright, with strong programming skills in C#.NET, Python, JavaScript/TypeScript, and Java.

<b>Leadership & Mentoring:</b> Led and mentored QA teams of 6+ engineers, driving 100% automation adoption and reducing production defects by ~40%, while partnering closely with product and engineering leadership.

<b>CI/CD & Enterprise Automation:</b> Extensive experience integrating automation into Azure DevOps and GitHub Actions pipelines, and architecting automation strategies across multiple enterprise product lines.

<b>Innovation & POCs:</b> Regularly evaluate and present new AI-enabled testing tools and approaches to leadership, including multi-agent QA workflows (n8n, Langflow, GPT, Claude, OpenRouter, Command-Code) for intelligent defect triage and root cause analysis.

I am based in Pune and available to discuss how my experience in AI-augmented quality engineering can contribute to your team's automation and innovation goals. My resume is attached for your review.

Thank you for your time and consideration. I look forward to the opportunity to speak further.

Best regards,
Tarun Kumar Babbar
+91-9623252365
babbartarunkumar@gmail.com
linkedin.com/in/tarunbabbar
Pune, India`;

export default function EmailAgent() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [gmailUser, setGmailUser] = useState(localStorage.getItem("agent_gmail_user") || "");
  const [gmailPass, setGmailPass] = useState(localStorage.getItem("agent_gmail_pass") || "");
  const [verified, setVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingIdx, setSendingIdx] = useState<string | null>(null);
  const [subject, setSubject] = useState("Application for {{title}} at {{company}}");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [logs, setLogs] = useState<{ text: string; type: string }[]>([]);
  const [resumeStatus, setResumeStatus] = useState("");
  const [showTemplate, setShowTemplate] = useState(false);
  const [showSent, setShowSent] = useState(true);

  const pendingJobs = jobs.filter(j => isCompanyEmail(j.email, j.company) && isValidJobTitle(j.title) && !j.email_sent);
  const sentJobs = jobs.filter(j => isCompanyEmail(j.email, j.company) && j.email_sent);
  const hiddenCount = jobs.filter(j => !isCompanyEmail(j.email, j.company) || !isValidJobTitle(j.title)).length;

  useEffect(() => { api.getJobs("?exclude_ignored=false").then(d => setJobs(d.jobs)); }, []);

  const log = (text: string, type = "info") => {
    setLogs(prev => [...prev, { text, type }]);
  };

  const handleVerify = async () => {
    try {
      await api.verifyGmail(gmailUser, gmailPass);
      setVerified(true);
      localStorage.setItem("agent_gmail_user", gmailUser);
      localStorage.setItem("agent_gmail_pass", gmailPass);
      log("✅ Gmail authenticated", "ok");
    } catch (e: any) { setVerified(false); log("❌ Auth failed: " + e.message, "err"); }
  };

  const handleUploadResume = async () => {
    const input = document.getElementById("resumeFileInput") as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    try {
      const d = await api.uploadResume(file);
      setResumeStatus("✅ " + d.message);
      log("📎 Resume saved", "ok");
    } catch (e: any) { setResumeStatus("❌ " + e.message); }
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
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, email_sent: true } : j));
      log(`✅ ${job.company || "Unknown"}`, "ok");
    } catch (e: any) {
      log(`❌ ${job.company || "Unknown"}: ${e.message}`, "err");
    }
    setSendingIdx(null);
  };

  const handleSendAll = async () => {
    setSending(true); setLogs([]);
    log(`▶ Starting batch — ${pendingJobs.length} emails`, "info");
    let success = 0, failed = 0;
    for (const job of pendingJobs) {
      try { await sendOne(job); success++; } catch { failed++; }
    }
    log(`${success} sent, ${failed} failed`, success > 0 ? "ok" : "err");
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      {/* Header bar */}
      <div className="flex items-center gap-4 pb-3 border-b border-[#ede3da]">
        <h2 className="font-bold text-[#1c1917] flex items-center gap-2"><Mail size={18} className="text-amber-600" /> Email Agent</h2>
        <div className="flex gap-3 text-[13px] text-[#7c6e60] ml-2">
          <span className="font-semibold text-amber-700">{pendingJobs.length} pending</span>
          <span className="text-stone-300">·</span>
          <span className="font-semibold text-emerald-700">{sentJobs.length} sent</span>
          {hiddenCount > 0 && <><span className="text-stone-300">·</span><span className="text-stone-400">{hiddenCount} hidden</span></>}
        </div>
        <div className="ml-auto flex gap-2">
          {pendingJobs.length > 0 && (
            <button disabled={!verified || sending} onClick={handleSendAll}
              className="px-4 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-30 transition-colors flex items-center gap-1.5">
              {sending ? <><Loader2 size={12} className="animate-spin" /> Sending...</> : <><Send size={12} /> Send All ({pendingJobs.length})</>}
            </button>
          )}
        </div>
      </div>

      {/* Auth row — compact */}
      <div className="flex items-center gap-3 py-2.5 border-b border-[#ede3da]">
        <FileText size={14} className="text-stone-400 shrink-0" />
        <input type="file" id="resumeFileInput" accept=".pdf,.docx" className="text-[11px] w-28" />
        <button onClick={handleUploadResume} className="px-2 py-1 text-[11px] bg-[#f5f0eb] rounded hover:bg-[#ede3da] shrink-0">Upload</button>
        {resumeStatus && <span className="text-[10px] text-emerald-600 truncate max-w-32">{resumeStatus}</span>}
        <span className="text-stone-300">|</span>
        <ShieldCheck size={14} className="text-stone-400 shrink-0" />
        <input type="email" value={gmailUser} onChange={e => setGmailUser(e.target.value)}
          placeholder="you@gmail.com" className="w-36 px-2 py-1 text-[11px] border border-[#ede3da] rounded outline-none focus:border-amber-300" />
        <input type="password" value={gmailPass} onChange={e => setGmailPass(e.target.value)}
          placeholder="App password" className="w-32 px-2 py-1 text-[11px] border border-[#ede3da] rounded outline-none focus:border-amber-300" />
        <button onClick={handleVerify}
          className={cn("px-2.5 py-1 text-[11px] font-medium rounded shrink-0", verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-600 text-white hover:bg-amber-700")}>
          {verified ? <><CheckCircle size={12} className="inline mr-1" /> OK</> : "Verify"}
        </button>
        <button onClick={() => setShowTemplate(!showTemplate)} className="ml-auto text-[11px] text-[#7c6e60] hover:text-amber-700 flex items-center gap-1">
          {showTemplate ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Template
        </button>
      </div>

      {/* Template — collapsible */}
      {showTemplate && (
        <div className="py-2.5 border-b border-[#ede3da] space-y-2">
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-[#ede3da] rounded-md outline-none focus:border-amber-300" />
          <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={8}
            className="w-full px-2.5 py-2 text-xs border border-[#ede3da] rounded-md outline-none focus:border-amber-300 font-mono resize-y" />
          <p className="text-[10px] text-[#b8ae9e]">{"{{company}} {{title}} {{location}}"}</p>
        </div>
      )}

      {/* Main: Two columns */}
      <div className="flex gap-4 flex-1 overflow-hidden pt-3">
        {/* Left: Pending queue */}
        <div className="flex-1 flex flex-col min-w-0">
          {pendingJobs.length > 0 ? (
            <div className="border border-amber-200 rounded-xl overflow-hidden bg-white flex-1">
              <div className="px-3 py-2 bg-amber-50/60 border-b border-amber-100 text-[11px] font-semibold text-amber-800">
                Pending ({pendingJobs.length})
              </div>
              <div className="overflow-y-auto flex-1">
                {pendingJobs.map((j) => {
                  const isSending = sendingIdx === j.id;
                  return (
                    <div key={j.id} className="flex items-center gap-2 px-3 py-2 border-b border-[#f5f0eb] last:border-0 hover:bg-amber-50/40 transition-colors group">
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        <span className="text-[13px] font-semibold text-[#1c1917] truncate w-[140px] shrink-0">{j.company}</span>
                        <span className="text-xs text-amber-700 truncate w-[180px] shrink-0">{j.title}</span>
                        <span className="text-[11px] text-[#b8ae9e] truncate">{j.email}</span>
                      </div>
                      <button
                        disabled={!verified || isSending || sending}
                        onClick={() => sendOne(j)}
                        className="shrink-0 px-2.5 py-1 text-[10px] font-medium rounded border border-amber-200 text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-amber-50 disabled:opacity-0"
                      >
                        {isSending ? <Loader2 size={10} className="animate-spin" /> : "Send"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[13px] text-[#b8ae9e]">
              {sentJobs.length > 0 ? "🎉 All emails sent!" : "No pending emails. Upload job listings on the Dashboard first."}
            </div>
          )}
        </div>

        {/* Right: Activity + Sent — equal 50/50 split */}
        <div className="w-[340px] shrink-0 flex flex-col gap-3 overflow-hidden">
          {/* Activity log */}
          <div className="border border-[#ede3da] rounded-xl bg-white overflow-hidden flex flex-col" style={{ height: "calc(50% - 6px)" }}>
            <div className="px-3 py-2 bg-[#faf7f5] border-b border-[#ede3da] text-[11px] font-semibold text-[#7c6e60] flex items-center gap-1.5 shrink-0">
              <Activity size={12} /> Activity ({logs.length})
            </div>
            <div className="overflow-y-auto flex-1">
              {logs.length > 0 ? (
                logs.slice().reverse().map((l, i) => (
                  <div key={i} className={cn("px-3 py-1.5 border-b border-[#f5f0eb] last:border-0 text-[11px]", l.type === "ok" ? "text-emerald-700" : l.type === "err" ? "text-red-600" : "text-[#7c6e60]")}>
                    {l.text}
                  </div>
                ))
              ) : (
                <div className="px-3 py-6 text-[11px] text-[#b8ae9e] text-center">No activity yet</div>
              )}
            </div>
          </div>

          {/* Sent */}
          <div className="border border-emerald-200 rounded-xl bg-white overflow-hidden flex flex-col" style={{ height: "calc(50% - 6px)" }}>
            <button onClick={() => setShowSent(!showSent)}
              className="w-full px-3 py-2 bg-emerald-50/50 border-b border-emerald-100 text-[11px] font-semibold text-emerald-700 flex items-center justify-between shrink-0">
              <span>Sent ({sentJobs.length})</span>
              {showSent ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {showSent && (
              <div className="overflow-y-auto flex-1">
                {sentJobs.length > 0 ? (
                  sentJobs.map((j) => (
                    <div key={jobs.indexOf(j)} className="flex items-center gap-2 px-3 py-1.5 border-b border-[#f5f0eb] last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-[#1c1917] truncate">{j.company}</div>
                        <div className="text-[10px] text-[#b8ae9e] truncate">{j.title} · {j.email}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">✓</span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-[11px] text-[#b8ae9e] text-center">Nothing sent yet</div>
                )}
              </div>
            )}
          </div>

          {hiddenCount > 0 && (
            <div className="text-[10px] text-stone-400 text-center shrink-0">{hiddenCount} email(s) hidden (non-company)</div>
          )}
        </div>
      </div>
    </div>
  );
}
