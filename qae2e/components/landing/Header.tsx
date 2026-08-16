import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeaderUserMenu } from "./HeaderUserMenu";
import { getSessionUser } from "@/lib/auth/session";

// Single shared header-button look, matching the Sign In button (amber primary).
const headerBtn =
  "inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 transition-colors";

export async function Header() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-6 h-[72px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-text-primary">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500 text-white shadow-sm">
            <Sparkles size={18} />
          </span>
          QAE2E
        </Link>
        <nav className="hidden md:flex items-center gap-2.5">
          <Link href="/#flow" className={headerBtn}>The flow</Link>
          <Link href="/#agents" className={headerBtn}>AI agents</Link>
          <Link href="/#integrations" className={headerBtn}>Integrations</Link>
          {user && (
            <Link href="/workspaces" className={headerBtn}>My workspaces</Link>
          )}
        </nav>
        {user ? (
          <div className="flex items-center gap-2.5">
            <HeaderUserMenu />
          </div>
        ) : (
          <Button href="/login" className="min-h-9 px-4">
            Sign in <ArrowRight size={15} />
          </Button>
        )}
      </div>
    </header>
  );
}
