import Link from "next/link";
import { PAGES } from "@/lib/site";

const socials = [
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/tarunbabbar",
  },
  {
    label: "GitHub",
    href: "https://github.com/TarunBabbar",
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/919623252365",
  },
  {
    label: "Phone",
    href: "tel:+919623252365",
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-bg-card">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="text-base font-extrabold tracking-tight text-text hover:text-amber-600 transition-colors"
            >
              Tarun Kumar <span className="text-amber-600">Babbar</span>
            </Link>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed max-w-sm">
              AI QA Architect and Test Automation Architect — building multi-agent
              QA platforms and enterprise Playwright automation that turn a
              requirement into release-ready confidence.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 text-amber-700 text-[11px] font-semibold px-3 py-1 rounded-full">
              <span>🏆</span>
              1st Place · AI Tester Blueprint 3x Hackathon
            </div>
          </div>

          {/* Pages */}
          <nav aria-label="Footer">
            <h3 className="text-xs font-bold uppercase tracking-[1.5px] text-text-muted mb-3">
              Pages
            </h3>
            <ul className="space-y-2">
              {PAGES.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className="text-sm text-text-secondary hover:text-amber-600 transition-colors"
                  >
                    {page.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Connect */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[1.5px] text-text-muted mb-3">
              Connect
            </h3>
            <ul className="space-y-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-secondary hover:text-amber-600 transition-colors"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-text-muted">📍 Pune, India</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-6">
          <p className="text-xs text-text-muted text-center sm:text-left">
            © {new Date().getFullYear()} Tarun Kumar Babbar · Built with Next.js,
            Tailwind CSS & Framer Motion
          </p>
          <a
            href="#top"
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
          >
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
