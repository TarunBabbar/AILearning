"use client";

import { motion } from "framer-motion";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const stats = [
  { num: "18+", label: "Years in QA Engineering" },
  { num: "8", label: "AI Platforms Built" },
  { num: "100%", label: "Automation Adoption" },
  { num: "~40%", label: "Prod Defect Reduction" },
  { num: "10", label: "Projects Built" },
];

export default function Hero() {
  return (
    <>
      <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-gradient-to-br from-cream via-cream-alt to-cream-deep">
        {/* Decorative blobs */}
        <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-amber-600/4 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-28 pb-20 w-full">
          <div className="flex items-center gap-12 lg:gap-16">
            {/* Photo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden md:block shrink-0"
            >
              <div className="w-40 h-40 lg:w-52 lg:h-52 rounded-full overflow-hidden border-4 border-amber-200/60 shadow-xl shadow-amber-500/10">
                <img
                  src="/tarun-babbar.jpg"
                  alt="Tarun Kumar Babbar"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

          <motion.div
            initial="initial"
            animate="animate"
            variants={stagger}
            className="max-w-3xl"
          >
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Open to AI / Test Architect roles
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-[clamp(2.5rem,7vw,4.5rem)] font-extrabold leading-[1.08] tracking-[-0.04em] mb-5"
            >
              Tarun Kumar{" "}
              <span className="bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">
                Babbar
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mb-8"
            >
              Test Automation Architect with 18+ years building enterprise-grade
              automation frameworks (Selenium, Playwright, C#.NET, TypeScript)
              across UI, API, database, and E2E. Designed a skills-based AI
              automation framework fusing classical test automation with RAG,
              MCP, and Vector DBs. Built 8+ AI platforms and agentic QA systems —
              from RAG pipelines to multi-agent test copilots.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-3 items-center">
              <a
                href="#projects"
                className="inline-flex items-center gap-2 bg-text text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-[#2a201a] transition-all hover:-translate-y-0.5"
              >
                Explore Work ↓
              </a>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 bg-surface text-text px-6 py-3 rounded-lg text-sm font-semibold border border-border hover:border-amber-400 hover:bg-amber-50 transition-all hover:-translate-y-0.5"
              >
                Get in Touch
              </a>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex flex-wrap gap-x-5 gap-y-2 mt-8 text-sm text-text-muted"
            >
              <a href="tel:+919623252365" className="hover:text-amber-600 transition-colors">
                📞 +91 9623252365
              </a>
              <a href="mailto:babbartarunkumar@gmail.com" className="hover:text-amber-600 transition-colors">
                ✉ babbartarunkumar@gmail.com
              </a>
              <a href="https://linkedin.com/in/tarunbabbar" target="_blank" className="hover:text-amber-600 transition-colors">
                in /tarunbabbar
              </a>
              <a href="https://github.com/TarunBabbar" target="_blank" className="hover:text-amber-600 transition-colors">
                gh /TarunBabbar
              </a>
              <span>📍 Pune, India</span>
            </motion.div>
          </motion.div>
          </div>{/* flex wrapper */}
        </div>
      </section>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="bg-surface border-b border-border"
      >
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="text-center"
              >
                <div className="text-3xl font-extrabold tracking-tight">
                  <span className="text-amber-600">{s.num}</span>
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
