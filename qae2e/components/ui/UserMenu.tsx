"use client";

// User menu — avatar with the user's initial + a dropdown showing name/email
// and a Sign out action. Replaces the username chip + separate Sign out button.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User } from "lucide-react";

export function UserMenu({
  name,
  email,
  onLogout,
}: {
  name?: string;
  email?: string;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const initial = (name || email || "?").charAt(0).toUpperCase();

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 min-h-9 pl-1.5 pr-3 rounded-full border border-border bg-bg-surface text-text-primary hover:border-amber-500/40 hover:bg-bg-hover transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
        title={name || email}
      >
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold">
          {initial}
        </span>
        <span className="text-sm font-semibold max-w-[110px] truncate hidden sm:inline">
          {name || "Account"}
        </span>
        <ChevronDown size={13} className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-bg-surface card-shadow-lg p-1.5 z-50">
          <div className="px-3 py-2.5 border-b border-border mb-1">
            <p className="text-sm font-semibold text-text-primary truncate">{name || "Account"}</p>
            {email && <p className="text-xs text-text-muted truncate">{email}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
