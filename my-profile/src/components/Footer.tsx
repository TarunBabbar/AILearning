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
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-card/95 backdrop-blur-md">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
            <span className="text-sm font-bold tracking-tight text-text">
              Tarun Kumar <span className="text-amber-600">Babbar</span>
            </span>
            <span className="hidden sm:inline text-text-muted">·</span>
            <span className="text-xs text-text-secondary">
              AI QA Architect and Test Automation Architect
            </span>
            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
              <span>🏆</span>
              1st Place · AI Tester Blueprint 3x Hackathon
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-text-secondary hover:text-amber-600 transition-colors"
              >
                {s.label}
              </a>
            ))}
            <span className="text-[11px] text-text-muted">
              © {new Date().getFullYear()} Tarun Kumar Babbar
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
