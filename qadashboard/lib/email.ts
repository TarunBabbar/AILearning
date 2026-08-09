import nodemailer from "nodemailer";
import { getConfig } from "./config";

let cached: { user: string; pass: string; transporter: nodemailer.Transporter } | null = null;

function getTransporter() {
  const cfg = getConfig();
  if (!cfg.gmailUser || !cfg.gmailPass) {
    throw new Error("Gmail SMTP not configured (GMAIL_USER / GMAIL_PASS)");
  }
  if (!cached || cached.user !== cfg.gmailUser || cached.pass !== cfg.gmailPass) {
    cached = {
      user: cfg.gmailUser,
      pass: cfg.gmailPass,
      transporter: nodemailer.createTransport({
        service: "gmail",
        auth: { user: cfg.gmailUser, pass: cfg.gmailPass },
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
      }),
    };
  }
  return cached.transporter;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<void> {
  const cfg = getConfig();
  await getTransporter().sendMail({ from: cfg.gmailUser, to, subject, html, text });
}
