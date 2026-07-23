import express from "express";
import multer from "multer";
import { extractText, parseJobsFromFile } from "./parser.js";
import { callOpenRouter } from "./openrouter.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { config } from "dotenv";
config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");

const PORT = parseInt(process.env.PORT || "5000");
const HOST = process.env.HOST || "127.0.0.1";
const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "50");
const MAX_JOBS_FILES = parseInt(process.env.MAX_JOBS_FILES || "20");
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465");
const SMTP_SECURE = process.env.SMTP_SECURE !== "false";
const SCORE_BATCH = parseInt(process.env.SCORE_BATCH_SIZE || "8");
const SCORE_TIMEOUT_MS = parseInt(process.env.SCORE_TIMEOUT_MS || "120000");
const SCORE_MAX_TOKENS = parseInt(process.env.SCORE_MAX_TOKENS || "8192");

const app = express();
app.use(express.json());

const storage = multer.diskStorage({
  destination: path.join(__dirname, "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pdf" || ext === ".docx") return cb(null, true);
    cb(new Error("Only PDF and DOCX files are allowed"));
  },
});

// In-memory store
let resumeText = null;
let resumeFilename = null;
let resumeFilePath = null;
let jobs = [];
let nextJobId = 1;

function newJobId() { return "j-" + (nextJobId++); }

// ─── Persistence ─────────────────────────────────────────
function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ resumeText, resumeFilename, resumeFilePath, jobs, nextJobId }, null, 2), "utf-8");
    // Auto-backup once per day
    const today = new Date().toISOString().slice(0, 10);
    const backupDir = path.join(__dirname, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `data-backup-${today}.json`);
    if (!fs.existsSync(backupFile)) {
      fs.copyFileSync(DATA_FILE, backupFile);
    }
  } catch {}
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      resumeText = d.resumeText || null;
      resumeFilename = d.resumeFilename || null;
      resumeFilePath = d.resumeFilePath || null;
      jobs = d.jobs || [];
      nextJobId = d.nextJobId || 1;
      // Migrate: assign IDs to jobs that don't have them
      for (const j of jobs) {
        if (!j.id) j.id = newJobId();
      }
    }
  } catch {}
}

loadData();
// Serve React SPA build (client/dist) if exists, fallback to templates
const clientDist = path.join(__dirname, "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
} else {
  app.use(express.static(path.join(__dirname, "public")));
}

// ─── Upload Resume ──────────────────────────────────────
app.post("/api/upload-resume", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    const text = await extractText(req.file.path);
    if (!text) return res.status(400).json({ error: "Could not extract text from file" });
    // Keep file for email attachment — rename to a fixed path
    resumeText = text;
    resumeFilename = req.file.originalname;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const keptPath = path.join(__dirname, "uploads", "resume-uploaded" + ext);
    try { fs.unlinkSync(keptPath); } catch {}
    fs.renameSync(req.file.path, keptPath);
    resumeFilePath = keptPath;
    saveData();
    res.json({ message: `Resume uploaded (${text.split(/\s+/).length} words).`, filename: req.file.originalname });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Upload Jobs ─────────────────────────────────────────
app.post("/api/upload-jobs", upload.array("files[]", MAX_JOBS_FILES), async (req, res) => {
  try {
    if (!req.files || !req.files.length)
      return res.status(400).json({ error: "No files provided" });

    const allJobs = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const parsed = await parseJobsFromFile(file.path);
        if (parsed && parsed.length) allJobs.push(...parsed);
        else errors.push(`No jobs found in '${file.originalname}'`);
      } catch (e) {
        errors.push(`Error parsing '${file.originalname}': ${e.message}`);
      } finally {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }
    if (allJobs.length) {
      // Append new jobs to existing ones — track duplicates separately
      const existingMap = new Map();
      for (let i = 0; i < jobs.length; i++) {
        const key = ((jobs[i].title || "") + "|" + (jobs[i].company || "")).toLowerCase();
        existingMap.set(key, i);
      }
      const newJobs = [];
      const duplicateJobs = [];
      for (const j of allJobs) {
        const key = ((j.title || "") + "|" + (j.company || "")).toLowerCase();
        if (existingMap.has(key)) {
          j.status = "duplicate";
          j.duplicate_of = existingMap.get(key);
          j.created_at = new Date().toISOString();
          duplicateJobs.push(j);
          continue;
        }
        existingMap.set(key, jobs.length + newJobs.length);
        newJobs.push(j);
      }
      for (const job of newJobs) {
        if (!job.status) job.status = "new";
        if (!job.id) job.id = newJobId();
        job.created_at = job.created_at || new Date().toISOString();
        jobs.push(job);
      }
      for (const job of duplicateJobs) {
        if (!job.id) job.id = newJobId();
        jobs.push(job);
      }
      saveData();
      res.json({
        message: `Added ${newJobs.length} new job(s), ${duplicateJobs.length} duplicate(s) moved to Duplicates tab. Total: ${jobs.length}.`,
        added: newJobs.length,
        duplicates: duplicateJobs.length,
        job_count: jobs.length,
        warnings: errors,
      });
    } else {
      res.json({
        message: `No jobs could be parsed. Total: ${jobs.length}.`,
        job_count: jobs.length,
        warnings: errors,
      });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Match ───────────────────────────────────────────────
app.post("/api/match", async (req, res) => {
  try {
    const scope = req.body?.scope || "unscored";
    console.log(`[MATCH] /api/match called — resumeText: ${resumeText ? resumeText.length + ' chars' : 'NULL'}, scope: ${scope}`);
    if (!resumeText) return res.status(400).json({ error: "No resume uploaded" });
    if (!jobs.length) return res.status(400).json({ error: "No job listings" });

    // Select which jobs to score based on scope
    let target = [];
    if (scope === "unscored") {
      target = jobs; // computeScores already filters unscored
    } else if (scope === "all") {
      // Reset all scores before re-scoring
      for (const j of jobs) j.score = undefined;
      target = jobs;
    } else if (scope === "new") {
      // Only new jobs — but don't skip already scored ones (re-score them too)
      for (const j of jobs) { if (j.status === "new") j.score = undefined; }
      target = jobs;
    } else if (scope === "ignored") {
      for (const j of jobs) { if (j.status === "ignored") j.score = undefined; }
      target = jobs;
    } else {
      return res.status(400).json({ error: "Invalid scope. Use: unscored, all, new, ignored" });
    }

    const results = await computeScores(resumeText, target);
    saveData();
    res.json({ resume: resumeFilename, total_jobs: results.length, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Get all jobs ────────────────────────────────────────
app.get("/api/jobs", (req, res) => {
  let result = jobs;
  if (req.query.status) {
    result = result.filter(j => j.status === req.query.status);
  }
  if (req.query.exclude_ignored !== "false") {
    result = result.filter(j => j.status !== "ignored");
  }
  res.json({ jobs: result, total: jobs.length, filtered: result.length });
});

// ─── Update job status ───────────────────────────────────
app.patch("/api/jobs/:index/status", (req, res) => {
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0 || idx >= jobs.length)
    return res.status(400).json({ error: "Invalid job index" });

  const { status } = req.body;
  const validStatuses = process.env.JOB_STATUSES
    ? process.env.JOB_STATUSES.split(",").map(s => s.trim())
    : ["new", "email_sent", "waiting_reply", "interviewing", "offer_received", "ignored"];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });

  jobs[idx].status = status;
  jobs[idx].status_updated_at = new Date().toISOString();
  // Auto-set email_sent fields when transitioning to email_sent
  if (status === "email_sent" && !jobs[idx].email_sent) {
    jobs[idx].email_sent = true;
    jobs[idx].email_sent_at = new Date().toISOString();
  }
  saveData();
  res.json({ message: `Status updated to "${status}"`, job: jobs[idx] });
});

// ─── Delete single job (soft delete) ────────────────────
app.delete("/api/jobs/:index", (req, res) => {
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0 || idx >= jobs.length)
    return res.status(400).json({ error: "Invalid job index" });
  jobs[idx].status = "deleted";
  jobs[idx].deleted_at = new Date().toISOString();
  jobs[idx].previous_status = jobs[idx].previous_status || jobs[idx].status === "deleted" ? jobs[idx].previous_status : undefined;
  saveData();
  res.json({ message: `Moved "${jobs[idx]?.title || 'job'}" to Deleted`, job_count: jobs.length, job: jobs[idx] });
});

// ─── Restore deleted job ─────────────────────────────────
app.patch("/api/jobs/:index/restore", (req, res) => {
  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0 || idx >= jobs.length)
    return res.status(400).json({ error: "Invalid job index" });
  if (jobs[idx].status !== "deleted")
    return res.status(400).json({ error: "Job is not deleted" });
  jobs[idx].status = jobs[idx].previous_status || "new";
  delete jobs[idx].deleted_at;
  saveData();
  res.json({ message: `Restored "${jobs[idx]?.title || 'job'}"`, job: jobs[idx] });
});

// ─── Delete all jobs (keep resume) ───────────────────────
app.delete("/api/jobs", (req, res) => {
  for (const j of jobs) {
    j.status = "deleted";
    j.deleted_at = new Date().toISOString();
  }
  saveData();
  res.json({ message: "All jobs moved to Deleted.", job_count: jobs.length });
});

// ─── Status & Clear ─────────────────────────────────────
app.get("/api/status", (req, res) => {
  res.json({
    resume_loaded: resumeText !== null,
    resume_filename: resumeFilename,
    resume_words: resumeText ? resumeText.split(/\s+/).length : 0,
    resume_file_exists: resumeFilePath ? fs.existsSync(resumeFilePath) : false,
    job_count: jobs.length,
  });
});

app.post("/api/clear", (req, res) => {
  if (resumeFilePath) { try { fs.unlinkSync(resumeFilePath); } catch {} }
  resumeText = null; resumeFilename = null; resumeFilePath = null; jobs = [];
  saveData();
  res.json({ message: "All data cleared." });
});

// ─── Send Email ─────────────────────────────────────────
function createTransporter(user, pass) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user, pass },
  });
}

app.post("/api/send-email", async (req, res) => {
  try {
    const { id, jobIdx, gmailUser, gmailPass } = req.body;
    let idx;
    if (id) {
      idx = jobs.findIndex(j => j.id === id);
      if (idx === -1) return res.status(400).json({ error: "Job not found" });
    } else {
      idx = parseInt(jobIdx, 10);
      if (isNaN(idx) || idx < 0 || idx >= jobs.length)
        return res.status(400).json({ error: "Invalid job index" });
    }
    if (!gmailUser || !gmailPass)
      return res.status(400).json({ error: "Gmail credentials required" });

    const job = jobs[idx];
    if (!job.email) return res.status(400).json({ error: "No email address for this job" });

    const transporter = createTransporter(gmailUser, gmailPass);

    const subject = req.body.subject || `Application for ${job.title || "Position"} at ${job.company || "Company"}`;
    const text = req.body.body || `Dear Hiring Team at ${job.company || "Company"},

I am writing to apply for the ${job.title || "position"} role.

I have attached my resume for your review.

Best regards,
${gmailUser}`;

    const mailOptions = {
      from: gmailUser,
      to: job.email,
      subject,
      html: (req.body.body || "").replace(/\n/g, "<br>"),
    };

    // Attach resume file if available (fallback: scan uploads dir)
    let attachPath = resumeFilePath;
    if (!attachPath || !fs.existsSync(attachPath)) {
      try {
        const files = fs.readdirSync(path.join(__dirname, "uploads")).filter(f => f.endsWith(".pdf") || f.endsWith(".docx"));
        if (files.length) attachPath = path.join(__dirname, "uploads", files[files.length - 1]);
      } catch {}
    }
    if (attachPath && fs.existsSync(attachPath)) {
      mailOptions.attachments = [{
        filename: resumeFilename || "resume" + path.extname(attachPath),
        path: attachPath,
      }];
    }

    await transporter.sendMail(mailOptions);

    job.email_sent = true;
    job.email_sent_at = new Date().toISOString();
    job.status = "email_sent";
    saveData();

    res.json({ message: `Email sent to ${job.email}`, email_sent: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Verify Gmail credentials ───────────────────────────
app.post("/api/verify-gmail", async (req, res) => {
  try {
    const { gmailUser, gmailPass } = req.body;
    if (!gmailUser || !gmailPass)
      return res.status(400).json({ error: "Credentials required" });
    const transporter = createTransporter(gmailUser, gmailPass);
    await transporter.verify();
    res.json({ verified: true });
  } catch (e) {
    res.status(401).json({ verified: false, error: e.message });
  }
});

// ─── Scoring (LLM-only, batched) ───────────────────────
// Jobs are scored in small batches so each LLM call's output stays within the token limit
// (large batches previously got truncated at max_tokens, producing invalid JSON / 0% scores).

function buildBatchPrompt(text, batch) {
  const sections = batch.map((j, i) => {
    const desc = (j.description || "");
    const truncated = desc.length > 300 ? desc.slice(0, 300) + "..." : desc;
    return `[JOB ${i + 1}]\nTitle: ${j.title || "Unknown"}\nCompany: ${j.company || "Unknown"}\nLocation: ${j.location || "N/A"}\nEmail: ${j.email || "N/A"}\nDescription: ${truncated}\n---`;
  });
  return `You are a precise resume-job matching AI. Compare the candidate's resume against each job listing below.

CANDIDATE RESUME:
${text}

JOBS:
${sections.join("\n")}

For each job, evaluate: skills overlap, experience alignment, domain relevance, and seniority fit. Keep "strengths" and "gaps" to ONE concise sentence each.

Respond with ONLY a valid JSON array — no markdown, no other text:
[{"idx":1,"score":85,"strengths":"...","gaps":"..."}, ...]

Scores 0-100. Strict JSON only.`;
}

async function computeScores(text, jobs) {
  const systemPrompt = "You are a precise resume-job matching AI. Compare the candidate's resume against each job listing. Respond with ONLY valid JSON.";

  // Only score jobs without existing scores
  const unscored = [];
  const scored = [];
  for (let i = 0; i < jobs.length; i++) {
    if (jobs[i].score === undefined) {
      unscored.push({ job: jobs[i], globalIdx: i });
    } else {
      scored.push(jobs[i]);
    }
  }

  if (!unscored.length) {
    console.log(`[Scoring] All ${jobs.length} jobs already scored. Sorting by existing scores.`);
    return jobs.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  console.log(`[Scoring] ${unscored.length} new jobs to score, ${scored.length} already scored (skipped)`);

  const unscoredJobs = unscored.map(u => u.job);

  for (let start = 0; start < unscoredJobs.length; start += SCORE_BATCH) {
    const batch = unscoredJobs.slice(start, start + SCORE_BATCH);
    const prompt = buildBatchPrompt(text, batch);
    console.log(`[Scoring] Calling OpenRouter for new jobs ${start + 1}-${start + batch.length} of ${unscoredJobs.length}...`);
    const content = await callOpenRouter(prompt, systemPrompt, { timeout: SCORE_TIMEOUT_MS, maxTokens: SCORE_MAX_TOKENS });
    console.log(`[Scoring] Batch ${start + 1}-${start + batch.length}: response ${content.length} chars`);
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error(`[Scoring] Batch ${start + 1}-${start + batch.length}: NO JSON ARRAY — response end: ${content.slice(-300)}`);
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (e) {
      console.error(`[Scoring] Batch ${start + 1}-${start + batch.length}: JSON parse FAILED: ${e.message}. Start: ${match[0].slice(0, 200)} End: ${match[0].slice(-200)}`);
      continue;
    }
    if (!Array.isArray(parsed)) {
      console.error(`[Scoring] Batch ${start + 1}-${start + batch.length}: Not an array`);
      continue;
    }
    console.log(`[Scoring] Parsed ${parsed.length} scores: ${JSON.stringify(parsed.map(e => ({idx: e.idx, score: e.score})))}`);
    for (const e of parsed) {
      const idx = e.idx !== undefined ? e.idx : 1;
      const localIdx = idx >= 1 ? idx - 1 : idx;
      if (localIdx >= 0 && localIdx < batch.length) {
        const globalIdx = unscored[start + localIdx].globalIdx;
        jobs[globalIdx].score = Math.round(Math.max(0, Math.min(100, e.score || 0)) * 10) / 10;
        jobs[globalIdx].scoring_method = "llm";
        if (e.strengths) jobs[globalIdx].strengths = e.strengths;
        if (e.gaps) jobs[globalIdx].gaps = e.gaps;
      }
    }
  }

  jobs.sort((a, b) => (b.score || 0) - (a.score || 0));
  return jobs;
}

// ─── Upload resume attachment (for agent page) ─────────
app.post("/api/upload-resume-attachment", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    // Also extract text so it can be used for matching
    const text = await extractText(req.file.path);
    const ext = path.extname(req.file.originalname).toLowerCase();
    const keptPath = path.join(__dirname, "uploads", "resume-uploaded" + ext);
    try { fs.unlinkSync(keptPath); } catch {}
    fs.renameSync(req.file.path, keptPath);
    resumeText = text;
    resumeFilename = req.file.originalname;
    resumeFilePath = keptPath;
    saveData();
    res.json({ message: "Resume saved for attachment.", filename: req.file.originalname });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Get resume text ───────────────────────────────────
app.get("/api/resume", (req, res) => {
  res.json({ text: resumeText || "", filename: resumeFilename, filePath: resumeFilePath });
});

// ─── Serve frontend (SPA fallback) ──────────────────────
app.get("*", (req, res) => {
  if (fs.existsSync(clientDist)) {
    res.sendFile(path.join(clientDist, "index.html"));
  } else {
    // Fallback to old templates
    if (req.path === "/agent") res.sendFile(path.join(__dirname, "templates", "agent.html"));
    else res.sendFile(path.join(__dirname, "templates", "index.html"));
  }
});

app.listen(PORT, HOST, () => {
  console.log(`\n  >> Resume-Job Matcher running at http://${HOST}:${PORT}`);
  console.log(`  >> Upload PDF/DOCX files to match against your resume.\n`);
});
