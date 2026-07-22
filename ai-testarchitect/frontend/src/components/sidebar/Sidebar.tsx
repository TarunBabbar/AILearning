"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  LayoutDashboard,
  TestTube,
  FileText,
  ArrowRightLeft,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface SidebarProps {
  activeProject?: string;
  onSelectProject?: (id: string) => void;
}

const navItems = [
  { icon: MessageSquare, label: "Chat", href: "/" },
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: TestTube, label: "Tests", href: "/tests" },
  { icon: FileText, label: "Reports", href: "/reports" },
  { icon: ArrowRightLeft, label: "Migrate", href: "/migrate" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

const mockProjects: Project[] = [
  { id: "1", name: "Payment Gateway" },
  { id: "2", name: "User Management" },
  { id: "3", name: "E-Commerce App" },
];

export function Sidebar({ activeProject, onSelectProject }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [projects] = useState<Project[]>(mockProjects);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-bg-sidebar transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      <div className="flex items-center gap-2 p-3 border-b border-border">
        {!collapsed && (
          <span className="text-sm font-semibold text-amber-700 tracking-tight truncate">
            QA Copilot
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="p-2 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={18} />
            {!collapsed && <span className="font-medium">{item.label}</span>}
          </a>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-2 border-t border-border mt-2">
        {!collapsed && (
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Projects
            </span>
            <button className="p-1 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary">
              <Plus size={14} />
            </button>
          </div>
        )}
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelectProject?.(project.id)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left font-medium",
              activeProject === project.id
                ? "bg-amber-600/10 text-amber-800"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            )}
            title={collapsed ? project.name : undefined}
          >
            <FolderOpen size={16} />
            {!collapsed && <span className="truncate">{project.name}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}
