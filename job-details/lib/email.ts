import nodemailer from "nodemailer";
import { getConfig } from "./config";

export type EmailResult = { ok: boolean; error?: string };

function transporter() {
  const { smtp } = getConfig();
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
}

function send(
  to: string,
  subject: string,
  html: string
): Promise<EmailResult> {
  const { smtp } = getConfig();
  if (!smtp.user || !smtp.pass) {
    return Promise.resolve({ ok: false, error: "SMTP not configured." });
  }
  return transporter()
    .sendMail({
      from: `"${smtp.fromName}" <${smtp.fromEmail || smtp.user}>`,
      to,
      subject,
      html,
    })
    .then(() => ({ ok: true }))
    .catch((e) => ({
      ok: false,
      error: e instanceof Error ? e.message : "Email send failed.",
    }));
}

/** Branded base shell shared by all email templates. */
function shell(body: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f4ef;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ef;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)">
        <tr><td style="background:linear-gradient(135deg,#2b5797,#5a8fd6);padding:28px 32px;text-align:center">
          <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:.5px">QA Jobs Portal</div>
          <div style="font-size:13px;color:#dbe7f5;margin-top:4px">Daily QA Jobs Across India</div>
        </td></tr>
        <tr><td style="padding:32px">${body}</td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#8a8a8a">
          You received this because of activity on QA Jobs Portal.<br/>Browse jobs: qajobs.vercel.app
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

/** Welcome email — sent right after a user creates an account. */
export function welcomeEmailHtml(name: string): string {
  const body = `
    <h2 style="margin:0 0 12px;font-size:20px;color:#2b2b2b">Welcome, ${name}! 🎉</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#555">
      Your account is ready. Here's what you can do on <b>QA Jobs Portal</b>:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">
      <tr><td style="padding:10px 14px;background:#eef4fb;border-radius:8px;font-size:13px;color:#2b5797">
        🔎 <b>Browse daily QA jobs</b> — companies, locations, and eligibility across India
      </td></tr>
      <tr><td style="padding:6px"></td></tr>
      <tr><td style="padding:10px 14px;background:#eef4fb;border-radius:8px;font-size:13px;color:#2b5797">
        🎯 <b>Match by Resume</b> — upload your resume and get AI fit scores for every job
      </td></tr>
      <tr><td style="padding:6px"></td></tr>
      <tr><td style="padding:10px 14px;background:#eef4fb;border-radius:8px;font-size:13px;color:#2b5797">
        🤝 <b>Recruiter Contacts</b> — connect directly with hiring emails
      </td></tr>
    </table>
    <a href="${getConfig().appUrl || "https://qajobs.vercel.app"}" style="display:inline-block;background:#2b5797;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold">Start Exploring Jobs →</a>
    <p style="margin:20px 0 0;font-size:12px;color:#8a8a8a">Need help? Use the chat widget on the portal — we're here for you.</p>
  `;
  return shell(body);
}

/** Password reset email — contains a one-time reset link (not the password). */
export function resetEmailHtml(name: string, resetUrl: string): string {
  const body = `
    <h2 style="margin:0 0 12px;font-size:20px;color:#2b2b2b">Reset your password</h2>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#555">
      Hi ${name}, we received a request to reset your password. Click below to
      choose a new one. This link expires in <b>1 hour</b>.
    </p>
    <a href="${resetUrl}" style="display:inline-block;background:#2b5797;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold">Reset Password</a>
    <p style="margin:20px 0 0;font-size:12px;color:#8a8a8a">
      If you didn't request this, you can safely ignore this email — your
      password won't change.
    </p>
  `;
  return shell(body);
}

/** Send the welcome email. */
export async function sendWelcomeEmail(
  to: string,
  name: string
): Promise<EmailResult> {
  return send(to, `Welcome to QA Jobs Portal 🎉`, welcomeEmailHtml(name));
}

/** Send a password-reset email with a one-time link. */
export async function sendResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<EmailResult> {
  return send(to, `Reset your QA Jobs Portal password`, resetEmailHtml(name, resetUrl));
}

// ── Daily architect-jobs digest ──────────────────────────

/** One job row shown in the architect-jobs digest email. */
export type DigestJobRow = {
  title: string;
  company: string;
  type?: string | null;
  website?: string | null;
  location?: string | null;
  experience?: string | null;
  contactEmail?: string | null;
  description?: string | null;
  fileName?: string | null;
  addedAtLabel?: string;
};

/** Escape a value for safe interpolation into email HTML. */
function esc(value: string | null | undefined): string {
  if (value == null) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** HTML for the digest email listing today's architect jobs. */
export function architectDigestHtml(jobs: DigestJobRow[], label: string): string {
  const url = getConfig().appUrl || "https://qajobs.vercel.app";
  const cards = jobs
    .map((j) => {
      const website = j.website
        ? `<a href="${esc(j.website)}" style="color:#2b5797;text-decoration:none">${esc(j.company)}</a>`
        : `<span style="color:#2b5797;font-weight:bold">${esc(j.company)}</span>`;
      const meta: string[] = [];
      if (j.location) meta.push(`📍 <b>Location:</b> ${esc(j.location)}`);
      if (j.experience) meta.push(`⏳ <b>Experience:</b> ${esc(j.experience)}`);
      if (j.contactEmail)
        meta.push(`📧 <b>Contact:</b> <a href="mailto:${esc(j.contactEmail)}" style="color:#2b5797;text-decoration:none">${esc(j.contactEmail)}</a>`);
      if (j.fileName) meta.push(`📁 <b>Source:</b> ${esc(j.fileName)}`);
      if (j.addedAtLabel) meta.push(`🕘 <b>Added:</b> ${esc(j.addedAtLabel)}`);
      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #e5e2d9;border-radius:10px;overflow:hidden">
        <tr><td style="padding:16px 18px;background:#faf9f5">
          <div style="font-size:16px;font-weight:bold;color:#1f1f1f">${esc(j.title)}</div>
          <div style="font-size:13px;color:#2b5797;margin:4px 0 8px">${website}</div>
          ${meta.length ? `<div style="font-size:13px;line-height:1.8;color:#555">${meta.join("<br/>")}</div>` : ""}
          ${j.description ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #eee;font-size:12.5px;line-height:1.6;color:#444;white-space:pre-wrap">${esc(j.description)}</div>` : ""}
        </td></tr>
      </table>`;
    })
    .join("");
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;color:#2b2b2b">Architect jobs added today</h2>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#555">
      <b>${jobs.length}</b> QA / Test / Automation architect role(s) were added to the portal on
      <b>${esc(label)}</b>. Full details below.
    </p>
    ${cards}
    <a href="${url}" style="display:inline-block;background:#2b5797;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold">Browse all jobs →</a>
  `;
  return shell(body);
}

/** HTML for the digest email sent on weekdays with zero architect jobs. */
export function noArchitectJobsHtml(label: string): string {
  const body = `
    <h2 style="margin:0 0 12px;font-size:20px;color:#2b2b2b">No architect jobs today</h2>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#555">
      No QA / Test / Automation architect roles were added on <b>${esc(label)}</b>.
      We'll keep watching — the next digest arrives tomorrow at 9 PM.
    </p>
  `;
  return shell(body);
}

/** Send the daily digest listing today's architect jobs. */
export async function sendArchitectJobsDigestEmail(
  to: string,
  label: string,
  jobs: DigestJobRow[]
): Promise<EmailResult> {
  return send(to, `📬 Architect jobs today — ${label}`, architectDigestHtml(jobs, label));
}

/** Send the "no architect jobs today" confirmation. */
export async function sendNoArchitectJobsEmail(
  to: string,
  label: string
): Promise<EmailResult> {
  return send(to, `📭 No architect jobs today — ${label}`, noArchitectJobsHtml(label));
}
