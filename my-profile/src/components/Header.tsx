"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PAGES } from "@/lib/site";
import SocialLinks from "@/components/SocialLinks";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-bg/90 backdrop-blur-md border-b border-border shadow-sm"
          : "bg-bg/70 backdrop-blur-sm border-b border-border/60"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-text hover:text-amber-600 transition-colors"
        >
          Tarun Kumar <span className="text-amber-600">Babbar</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4">
          {PAGES.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`relative py-1 text-sm font-medium transition-colors ${
                  active
                    ? "text-amber-600"
                    : "text-text-secondary hover:text-amber-600"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-amber-500" />
                )}
              </Link>
            );
          })}
          <span className="ml-1 h-5 w-px bg-border" aria-hidden />
          <SocialLinks />
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-text-muted hover:text-amber-600 text-2xl p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          ☰
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-bg-card border-b border-border shadow-lg"
        >
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1">
            {PAGES.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                    active
                      ? "text-amber-600 bg-amber-500/10"
                      : "text-text-secondary hover:text-amber-600 hover:bg-bg-soft"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            <SocialLinks variant="menu" />
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
