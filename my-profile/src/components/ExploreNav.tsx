"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PAGES } from "@/lib/site";

export default function ExploreNav() {
  const pathname = usePathname();
  const others = PAGES.filter((page) => page.href !== pathname);

  return (
    <section className="py-16 sm:py-20 bg-bg-soft border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="text-xs font-semibold text-amber-600 tracking-[1.5px] uppercase mb-2">
            Keep Exploring
          </div>
          <h2 className="text-[clamp(1.4rem,2.4vw,1.9rem)] font-extrabold tracking-[-0.02em]">
            More of the profile
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {others.map((page, i) => (
            <motion.div
              key={page.href}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3) }}
            >
              <Link
                href={page.href}
                className="card-accent group flex h-full flex-col rounded-xl border border-border bg-bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:bg-bg-card-hover hover:shadow-md"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-bg-soft text-lg">
                    {page.icon}
                  </span>
                  <h3 className="font-bold text-text">{page.label}</h3>
                </div>
                <p className="flex-1 text-[13px] leading-relaxed text-text-secondary">
                  {page.blurb}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-amber-600 group-hover:text-amber-700">
                  Open
                  <span aria-hidden>→</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
