"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Jobs", icon: Upload },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-claude-border bg-[#f5f4ef]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-claude-accent text-white">
          <LayoutDashboard size={18} />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-claude-text">
            Job Details
          </div>
          <div className="text-[11px] text-claude-muted">Job Tracker</div>
        </div>
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
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-claude-text shadow-sm ring-1 ring-claude-border"
                  : "text-claude-muted hover:bg-white/60 hover:text-claude-text"
              )}
            >
              <Icon size={16} className={active ? "text-claude-accent" : ""} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-claude-border px-5 py-4">
        <div className="text-[11px] text-claude-muted">
          Powered by OpenRouter free models
        </div>
      </div>
    </aside>
  );
}
