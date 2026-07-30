"use client";

import { motion } from "framer-motion";

const contacts = [
  {
    icon: "📞",
    label: "Phone",
    value: "+91 9623252365",
    href: "tel:+919623252365",
  },
  {
    icon: "✉",
    label: "Email",
    value: "babbartarunkumar@gmail.com",
    href: "mailto:babbartarunkumar@gmail.com",
  },
  {
    icon: "🔗",
    label: "LinkedIn",
    value: "linkedin.com/in/tarunbabbar",
    href: "https://linkedin.com/in/tarunbabbar",
  },
  {
    icon: "⌨",
    label: "GitHub",
    value: "github.com/TarunBabbar",
    href: "https://github.com/TarunBabbar",
  },
];

export default function Contact() {
  return (
    <section id="contact" className="py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Connect
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em] mb-2">
            Let&apos;s Build Something
          </h2>
          <p className="text-text-secondary mb-10 leading-relaxed">
            Looking for an architect who understands both test automation and AI?
            <br />
            Open to Lead / Architect roles in AI-powered QA.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {contacts.map((c, i) => {
            const inner = (
              <div className="flex items-center gap-3.5 p-5 bg-surface border border-border rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all">
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <div className="text-sm font-semibold">{c.label}</div>
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
      </div>
    </section>
  );
}
