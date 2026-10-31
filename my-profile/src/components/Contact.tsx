"use client";

import { motion } from "framer-motion";

const contacts = [
  {
    icon: "🔗",
    label: "LinkedIn",
    value: "linkedin.com/in/tarunbabbar",
    href: "https://linkedin.com/in/tarunbabbar",
  },
  {
    icon: "🐙",
    label: "GitHub",
    value: "github.com/TarunBabbar",
    href: "https://github.com/TarunBabbar",
  },
];

export default function Contact() {
  return (
    <section id="contact" className="py-20 sm:py-24 bg-bg-soft border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Connect
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em] mb-3">
            Let&apos;s Build Something
          </h2>
          <p className="text-text-secondary mb-4 leading-relaxed max-w-3xl">
            I help organisations make quality an accelerator — from zero
            automation to AI-powered quality engineering.
            <br />
            <strong className="text-text">
              Open to Architect / Principal SDET / Senior Principal SDET / QA
              Head roles — building one scalable, maintainable AI solution that
              serves multiple teams, onboarding them onto a shared QA AI
              Platform that delivers consistent, quality outputs org-wide.
            </strong>
            <br />
            Explore my apps on GitHub or reach out below — let&apos;s talk about
            your quality roadmap.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {contacts.map((c, i) => {
            const inner = (
              <div className="card-accent flex items-center gap-3.5 p-5 bg-bg-card border border-border rounded-xl hover:border-amber-400 hover:bg-bg-card-hover transition-all">
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-text">{c.label}</div>
                  <div className="text-xs text-text-muted mt-0.5 break-all">{c.value}</div>
                </div>
              </div>
            );

            return (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                {c.href ? (
                  <a href={c.href} target="_blank" rel="noopener noreferrer">
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://github.com/TarunBabbar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-bg-card border border-amber-500/40 text-amber-700 hover:bg-amber-500/10 px-7 py-3.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5 shadow-sm"
            >
              <GitHubIcon className="w-5 h-5" />
              Explore My GitHub
            </a>
          </div>
          <p className="text-xs text-text-muted mt-3">
            Explore 20+ repos of AI apps, frameworks and experiments on GitHub —
            or connect with me on LinkedIn 👋
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
