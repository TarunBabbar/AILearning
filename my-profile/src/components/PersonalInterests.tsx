"use client";

import { motion } from "framer-motion";

const disciplines = [
  {
    icon: "🪐",
    title: "Astrology",
    desc: "Reading the movement of the planets and stars to understand character, timing and the rhythms of life.",
  },
  {
    icon: "🔢",
    title: "Numerology",
    desc: "Interpreting the meaning carried by numbers, names and dates, and how they shape a person's path.",
  },
  {
    icon: "⌚",
    title: "Watch Analysis",
    desc: "Reading the subtle energies and numerological signals carried by the watches we wear and the time we keep.",
  },
  {
    icon: "🏡",
    title: "Vastu",
    desc: "Aligning homes and spaces with natural forces so that surroundings support balance, harmony and wellbeing.",
  },
  {
    icon: "📜",
    title: "Akashic Records",
    desc: "Exploring the unseen record of a soul's journey to uncover insight, purpose and healing.",
  },
  {
    icon: "🔮",
    title: "Psychic Mastery",
    desc: "Developing intuition and the capacity to sense and work with energies beyond the physical world.",
  },
];

export default function PersonalInterests() {
  return (
    <section id="interests" className="py-20 sm:py-24 bg-bg-soft border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Beyond Work
          </div>
          <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em] mb-3">
            Personal Interests
          </h2>
          <p className="text-text-secondary leading-relaxed">
            My personal interests lie in <strong className="text-text">astrology and the occult
            sciences</strong> — the timeless study of how energy and unseen forces are believed to
            shape our lives. What began as curiosity has grown into a deep and enduring passion, one
            I pursue through both quiet study and hands-on practice.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-12"
        >
          <h3 className="text-lg font-bold tracking-[-0.01em] mb-3">
            Practising and Helping Others
          </h3>
          <p className="text-text-secondary leading-relaxed max-w-3xl mb-8">
            In my personal time, I practise these disciplines and offer guidance to people in need.
            I work across a range of traditions that share a common belief: that subtle energies and
            hidden patterns influence our health, relationships and choices.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {disciplines.map((d, i) => (
              <motion.div
                key={d.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="card-accent bg-bg-card border border-border rounded-xl p-6 hover:border-amber-400/70 transition-colors"
              >
                <div className="w-11 h-11 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-center text-xl mb-4">
                  {d.icon}
                </div>
                <h4 className="font-bold text-text mb-1.5">{d.title}</h4>
                <p className="text-sm text-text-secondary leading-relaxed">{d.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-12 card-accent bg-bg-card border border-border rounded-xl p-6 sm:p-8 max-w-4xl"
        >
          <h3 className="text-lg font-bold tracking-[-0.01em] mb-3">A Continuous Learner</h3>
          <p className="text-text-secondary leading-relaxed">
            I am a <strong className="text-text">continuous learner</strong> committed to the occult
            sciences. I devote my time to ongoing research and study — deepening my understanding of
            these traditions, refining my craft, and staying open to what each new line of inquiry
            reveals. For me, learning here is never finished; it is a lifelong journey into the
            unseen, and one I find endlessly rewarding.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
