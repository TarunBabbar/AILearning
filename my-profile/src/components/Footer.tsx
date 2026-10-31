const socials = [
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/tarunbabbar",
  },
  {
    label: "GitHub",
    href: "https://github.com/TarunBabbar",
  },
];

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-card/95 backdrop-blur-md">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
      <div className="max-w-5xl mx-auto px-4 py-2">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          <span className="text-xs font-bold tracking-tight text-text">
            Tarun Kumar <span className="text-amber-600">Babbar</span>
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-[10px] text-text-secondary">
            AI QA Architect and Test Automation Architect
          </span>
          <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 text-amber-700 text-[9px] font-semibold px-2 py-0.5 rounded-full">
            <span>🏆</span>
            1st Place · AI Tester Blueprint 3x Hackathon
          </span>
          <span className="text-text-muted">·</span>
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-medium text-text-secondary hover:text-amber-600 transition-colors"
            >
              {s.label}
            </a>
          ))}
          <span className="text-text-muted">·</span>
          <span className="text-[9px] text-text-muted">
            © {new Date().getFullYear()} Tarun Kumar Babbar
          </span>
        </div>
      </div>
    </footer>
  );
}
