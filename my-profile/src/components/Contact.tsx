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
  {
    icon: "💬",
    label: "WhatsApp",
    value: "+91 9623252365",
    href: "https://wa.me/919623252365",
  },
  {
    icon: "📞",
    label: "Phone",
    value: "+91 9623252365",
    href: "tel:+919623252365",
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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
            <a
              href="https://wa.me/919623252365?text=Hi%20Tarun%2C%20I%20came%20across%20your%20profile%20and%20would%20like%20to%20connect!"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 bg-[#25D366] text-white px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-[#1fb857] transition-all hover:-translate-y-0.5 shadow-lg shadow-[#25D366]/25"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.668-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Chat on WhatsApp
            </a>
          </div>
          <p className="text-xs text-text-muted mt-3">
            Explore 20+ repos of AI apps, frameworks and experiments on GitHub —
            or send a quick WhatsApp 👋
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
