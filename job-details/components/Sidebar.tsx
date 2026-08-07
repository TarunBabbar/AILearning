"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Upload, Building2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", label: "Company Jobs", icon: Building2 },
  { href: "/upload", label: "Upload Jobs", icon: Upload },
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
              QA Job Details
            </div>
            <div className="text-[11px] text-claude-muted">Job Tracker</div>
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

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-claude-border px-5 py-4">
          <div className="text-[11px] text-claude-muted">
            Powered by OpenRouter free models
          </div>
        </div>
      )}
    </aside>
  );
}
