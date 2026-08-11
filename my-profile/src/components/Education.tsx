"use client";

import { motion } from "framer-motion";

export default function Education() {
  return (
    <section className="py-14 sm:py-16 bg-surface">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Education
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-extrabold tracking-[-0.03em] mb-6">
            Where It Started
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-start gap-4 bg-cream border border-border rounded-xl p-6 max-w-lg"
        >
          <div className="w-11 h-11 min-w-[44px] bg-cream-deep rounded-lg flex items-center justify-center text-xl">
            🎓
          </div>
          <div>
            <h4 className="font-bold">Bachelor of Engineering, Computer Science</h4>
            <p className="text-sm text-text-secondary mt-0.5">
              Modi Institute of Technology, Kota
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
