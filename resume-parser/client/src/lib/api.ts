const BASE = "";

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(BASE + url, options);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Request failed");
  return d;
}

export const api = {
  getStatus() { return req<Status>("/api/status"); },
  getJobs(params?: string) { return req<{ jobs: Job[]; total: number; filtered: number }>("/api/jobs" + (params || "")); },
  getResume() { return req<{ text: string; filename: string }>("/api/resume"); },
  uploadResume(file: File) { const fd = new FormData(); fd.append("file", file); return req<{ message: string }>("/api/upload-resume", { method: "POST", body: fd }); },
  uploadJobs(files: File[]) { const fd = new FormData(); files.forEach(f => fd.append("files[]", f)); return req<{ message: string; added: number; job_count: number; warnings?: string[] }>("/api/upload-jobs", { method: "POST", body: fd }); },
  runMatch() { return req<{ resume: string; total_jobs: number; results: Job[] }>("/api/match", { method: "POST" }); },
  clearAll() { return req<{ message: string }>("/api/clear", { method: "POST" }); },
  deleteJob(idx: number) { return req<{ message: string }>("/api/jobs/" + idx, { method: "DELETE" }); },
  deleteAllJobs() { return req<{ message: string }>("/api/jobs", { method: "DELETE" }); },
  updateStatus(idx: number, status: string) { return req<{ message: string; job: Job }>("/api/jobs/" + idx + "/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); },
  verifyGmail(user: string, pass: string) { return req<{ verified: boolean }>("/api/verify-gmail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gmailUser: user, gmailPass: pass }) }); },
  sendEmail(idx: number, gmailUser: string, gmailPass: string, subject: string, body: string) { return req<{ message: string }>("/api/send-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobIdx: idx, gmailUser, gmailPass, subject, body }) }); },
};

import type { Status, Job } from "./types";
