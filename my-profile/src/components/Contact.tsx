"use client";

import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { SOCIALS } from "@/lib/site";
import { GitHubIcon, LinkedInIcon } from "@/components/icons";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  LinkedIn: LinkedInIcon,
  GitHub: GitHubIcon,
};

export default function Contact() {
  return (
    <section id="contact" className="py-14 sm:py-16 bg-bg-soft border-t border-border">
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
          <p className="text-text-secondary leading-relaxed max-w-3xl">
            I help organisations make quality an accelerator — from zero
            automation to AI-powered quality engineering.
            <br />
            <strong className="text-text">
              Open to Architect / Principal SDET / Senior Principal SDET / QA
              Head roles — building one scalable, maintainable AI solution that
              serves multiple teams, onboarding them onto a shared QA AI
              Platform that delivers consistent, quality outputs org-wide.
            </strong>
          </p>
        </motion.div>

        <div className="mt-8 grid sm:grid-cols-2 gap-4 max-w-2xl">
          {SOCIALS.map((s, i) => {
            const Icon = ICONS[s.label];
            return (
              <motion.a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="card-accent flex items-center gap-3.5 p-5 bg-bg-card border border-border rounded-xl hover:border-amber-400 hover:bg-bg-card-hover transition-all"
              >
                <span className="flex h-11 w-11 min-w-[44px] items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700">
                  {Icon && <Icon className="w-5 h-5" />}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text">{s.label}</div>
                  <div className="text-xs text-text-muted mt-0.5 break-all">
                    {s.handle}
                  </div>
                </div>
              </motion.a>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 text-sm text-text-muted"
        >
          📍 Pune, India — generally responsive on LinkedIn.
        </motion.p>
      </div>
    </section>
  );
}
