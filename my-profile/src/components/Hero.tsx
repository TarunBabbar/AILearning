"use client";

import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const stats = [
  { num: "18+", label: "Years in QA Engineering" },
  { num: "10+", label: "AI Apps & Agents Built" },
  { num: "1st", label: "AI Tester Blueprint 3x Hackathon" },
  { num: "100%", label: "Automation Adoption at Scale" },
];

export default function Hero() {
  return (
    <>
      <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-bg">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-16 w-full">
          <div className="flex items-start lg:items-center gap-10 lg:gap-14 flex-col lg:flex-row">
            {/* Photo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="shrink-0"
            >
              <div className="relative">
                <div className="absolute -inset-2 rounded-full bg-amber-500/15 blur-xl" />
                <div className="relative w-36 h-36 lg:w-48 lg:h-48 rounded-full overflow-hidden border-2 border-amber-500/30">
                  <img
                    src="/tarun-babbar.jpg"
                    alt="Tarun Kumar Babbar"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial="initial"
              animate="animate"
              variants={stagger}
              className="max-w-2xl text-center lg:text-left"
            >
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-700 border border-amber-500/25 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5"
              >
                <span>🏆</span>
                1st Place · AI Tester Blueprint 3x Hackathon · The Testing Academy
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-[clamp(1.9rem,4.5vw,3rem)] font-extrabold leading-[1.1] tracking-[-0.02em] mb-3"
              >
                Tarun Kumar Babbar
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="text-lg text-text-secondary font-medium leading-relaxed mb-3"
              >
                AI QA Architect · Test Automation Architect
              </motion.p>

              <motion.p
                variants={fadeUp}
                className="text-base text-text-muted leading-relaxed mb-7"
              >
                18+ years across QA engineering — building AI-powered QA
                platforms, multi-agent orchestration frameworks, and enterprise
                Playwright + TypeScript automation. 1st place at the AI Tester
                Blueprint 3x hackathon with an agentic QA pipeline that turns a
                requirement into release-ready confidence.
              </motion.p>

              <motion.div
                variants={fadeUp}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-7"
              >
                <a
                  href="#apps"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-all shadow-sm"
                >
                  Explore My AI Apps
                  <span aria-hidden>→</span>
                </a>
                <a
                  href="https://qae2e.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-bg-card border border-border-strong hover:border-amber-500 text-text font-semibold text-sm px-5 py-2.5 rounded-lg transition-all"
                >
                  QAE2E Live Demo
                </a>
                <a
                  href="https://github.com/TarunBabbar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-bg-card border border-border-strong hover:border-amber-500 text-text font-semibold text-sm px-5 py-2.5 rounded-lg transition-all"
                >
                  <GitHubIcon className="w-4 h-4" />
                  GitHub
                </a>
              </motion.div>

              <motion.div
                variants={fadeUp}
                className="flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start text-sm text-text-muted"
              >
                <a href="https://linkedin.com/in/tarunbabbar" target="_blank" rel="noopener noreferrer" className="hover:text-amber-600 transition-colors">
                  in /tarunbabbar
                </a>
                <a href="https://wa.me/919623252365" target="_blank" rel="noopener noreferrer" className="hover:text-amber-600 transition-colors">
                  WhatsApp
                </a>
                <a href="tel:+919623252365" className="hover:text-amber-600 transition-colors">
                  +91 9623252365
                </a>
                <span>📍 Pune, India</span>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="bg-bg-card border-y border-border"
      >
        <div className="max-w-6xl mx-auto px-6 py-7">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.07 }}
                className="text-center"
              >
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-600">
                  {s.num}
                </div>
                <div className="text-xs text-text-muted font-medium mt-1">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
