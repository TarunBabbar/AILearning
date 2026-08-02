import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6 h-[72px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-text-primary">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500 text-white shadow-sm">
            <Sparkles size={18} />
          </span>
          QAE2E
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-text-secondary">
          <Link href="/#flow" className="hover:text-amber-700 transition-colors">The flow</Link>
          <Link href="/#agents" className="hover:text-amber-700 transition-colors">AI agents</Link>
          <Link href="/#integrations" className="hover:text-amber-700 transition-colors">Integrations</Link>
          <Link href="/workspace" className="hover:text-amber-700 transition-colors">Workspace</Link>
        </nav>
        <Button href="/workspace" className="min-h-9 px-4">
          Open workspace
        </Button>
      </div>
    </header>
  );
}
