"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, PanelLeftClose, PanelLeftOpen, Info, Contact, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "All Jobs", icon: LayoutDashboard },
  { href: "/browse", label: "Browse Jobs", icon: Building2 },
  { href: "/contacts", label: "Recruiter Contacts", icon: Contact },
  { href: "/score", label: "Match by Resume", icon: Target },
];

const COLLAPSE_KEY = "jobdetails_sidebar_collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Restore collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-claude-border bg-[#f5f4ef] transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Brand + collapse toggle */}
      <div className={cn("flex items-center py-4", collapsed ? "justify-center px-2" : "justify-between gap-2 px-4")}>
        <div className={cn("flex items-center gap-3", collapsed && "sr-only")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-claude-accent text-white">
            <LayoutDashboard size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-claude-text">
              QA Tracker
            </div>
            <div className="text-[11px] text-claude-muted">Job Opportunities</div>
          </div>
        </div>
        <button
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-claude-muted transition-colors hover:bg-white hover:text-claude-text"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-2",
                active
                  ? "bg-white text-claude-text shadow-sm ring-1 ring-claude-border"
                  : "text-claude-muted hover:bg-white/60 hover:text-claude-text"
              )}
            >
              <Icon size={16} className={cn("shrink-0", active ? "text-claude-accent" : "")} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {/* Built by credit */}
      {!collapsed && (
        <div className="border-t border-claude-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-claude-accent text-[10px] font-bold text-white">
              TK
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold text-claude-text">
                Built by Tarun Kumar Babbar
              </div>
              <div className="text-[10px] text-claude-muted">
                Solutions Architect
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note — always visible when the sidebar is expanded */}
      {!collapsed && (
        <div className="border-t border-claude-border px-3 py-3">
          <div className="rounded-lg border border-[#eadfc2] bg-[#fbf6e9] p-3">
            <div className="flex items-center gap-1.5">
              <Info size={13} className="shrink-0 text-[#9a7b2d]" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#7a6120]">
                Note
              </span>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#6b5a2e]">
              Job details are AI-extracted and may contain mistakes. Verify
              with the original posting — email the recruiter to confirm the
              opening is still available.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
