"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useSidebar } from "../../lib/sidebar-context";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/qa-assistant", label: "QA Assistant", icon: MessageSquare },
  { href: "/questions", label: "Questions", icon: BookOpen },
  // { href: "/upload", label: "Upload", icon: Upload }, // disabled — seed only
];

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-screen bg-sidebar-bg flex flex-col z-50 transition-all duration-200 border-r border-claude-border ${
          collapsed ? "w-14" : "w-60"
        }`}
        style={{ overflow: "hidden" }}
      >
        {/* Toggle button — straddles the right border */}
        <button
          onClick={toggle}
          className="absolute right-2 top-6 w-7 h-7 rounded-full bg-claude-beige-dark border border-claude-border flex items-center justify-center hover:bg-claude-beige active:scale-95 transition-all z-10 shadow-sm"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft size={12} className="text-claude-text" />
          ) : (
            <PanelLeftClose size={12} className="text-claude-text" />
          )}
        </button>

        {/* Logo area */}
        {collapsed ? null : (
          <div className="px-5 py-6 border-b border-claude-border/50 shrink-0">
            <h1 className="text-lg font-semibold text-claude-text tracking-tight">
              QA Interview
            </h1>
            <p className="text-xs text-claude-text-muted mt-0.5">Preparation Kit</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 pt-14 pb-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-sidebar-active text-claude-text font-semibold"
                    : "text-claude-text-muted hover:bg-sidebar-hover hover:text-claude-text"
                } ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                {collapsed ? null : <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {collapsed ? null : (
          <div className="px-5 py-4 border-t border-claude-border/50 shrink-0">
            <p className="text-xs text-claude-text-light">
              Powered by OpenRouter + RAG
            </p>
          </div>
        )}
      </aside>

      {/* Spacer to push main content */}
      <div
        className="shrink-0 transition-all duration-200"
        style={{ width: collapsed ? "3.5rem" : "15rem" }}
      />
    </>
  );
}
