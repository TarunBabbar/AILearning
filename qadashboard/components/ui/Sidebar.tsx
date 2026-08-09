"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/lib/sidebar-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  MessageSquare,
  BookOpen,
  Beaker,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Mail,
  FolderTree,
  TestTube,
  LogOut,
  User,
} from "lucide-react";

const navItems = [
  {
    section: "Main",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    section: "Modules",
    items: [
      {
        href: "/resume",
        label: "Resume & Jobs",
        icon: Briefcase,
        children: [
          { href: "/resume/matches", label: "Matches", icon: FileText },
          { href: "/resume/email", label: "Email Agent", icon: Mail },
          { href: "/resume/companies", label: "Companies", icon: FolderTree },
        ],
      },
      {
        href: "/qa",
        label: "QA Interview",
        icon: MessageSquare,
        children: [
          { href: "/qa", label: "Chat", icon: MessageSquare },
          { href: "/qa/topics", label: "Topics", icon: BookOpen },
        ],
      },
      { href: "/documents", label: "Documents", icon: FileText },
      {
        href: "/test-architect",
        label: "Test Architect",
        icon: Beaker,
        children: [
          { href: "/test-architect", label: "New Analysis", icon: Beaker },
          { href: "/test-architect/projects", label: "Projects", icon: TestTube },
        ],
      },
      { href: "/learn", label: "Learning Tutor", icon: GraduationCap },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, setCollapsed } = useSidebar();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-bg-sidebar border-r border-border transition-all duration-200 flex-shrink-0",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div className="flex items-center justify-between h-14 px-3 border-b border-border">
        {!collapsed && (
          <span className="font-semibold text-sm text-text-primary truncate">
            QA AI Dashboard
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md hover:bg-bg-hover text-text-muted"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {navItems.map((section) => (
          <div key={section.section}>
            {!collapsed && (
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider px-2 mb-1">
                {section.section}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      onMouseEnter={() => router.prefetch(item.href)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                        active
                          ? "bg-white text-text-primary shadow-sm ring-1 ring-border font-medium"
                          : "text-text-secondary hover:bg-white/60 hover:text-text-primary"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon
                        size={18}
                        className={cn("flex-shrink-0", active && "text-amber-500")}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>

                    {!collapsed && active && item.children && (
                      <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-2">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = pathname === child.href;
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              prefetch
                              onMouseEnter={() => router.prefetch(child.href)}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors",
                                childActive
                                  ? "bg-white text-text-primary shadow-sm ring-1 ring-border font-medium"
                                  : "text-text-secondary hover:bg-white/60 hover:text-text-primary"
                              )}
                            >
                              <ChildIcon
                                size={16}
                                className={cn("flex-shrink-0", childActive && "text-amber-500")}
                              />
                              <span className="truncate">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-2 py-2">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600">
              <User size={16} />
            </div>
          </div>
        ) : (
          <div className="px-2 space-y-1">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <User size={16} className="text-amber-500 flex-shrink-0" />
              <span className="truncate">{user?.username || "User"}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-red-500 transition-colors w-full px-2 py-1 rounded-md hover:bg-bg-hover"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
