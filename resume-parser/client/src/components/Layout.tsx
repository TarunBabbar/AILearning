import { Outlet, NavLink } from "react-router-dom";
import { useState } from "react";
import { LayoutDashboard, Mail, ChevronLeft, ChevronRight, BriefcaseBusiness, Ban, TrendingDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — Claude-like warm */}
      <aside className={cn(
        "flex flex-col border-r border-[#ede3da] transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}>
        <div className="flex items-center justify-between px-4 h-13 border-b border-[#ede3da]">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <BriefcaseBusiness size={18} className="text-amber-600" />
              <span className="font-semibold text-[13px] text-[#1c1917] whitespace-nowrap">Job Matcher</span>
            </div>
          )}
          {collapsed && <BriefcaseBusiness size={18} className="text-amber-600 mx-auto" />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-[#f5f0eb] text-[#a89f93] hover:text-[#1c1917] transition-colors ml-auto"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5">
          <NavLink
            to="/"
            className={({ isActive }) => cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
              isActive ? "bg-amber-50 text-amber-800" : "text-[#7c6e60] hover:bg-[#f5f0eb] hover:text-[#1c1917]"
            )}
          >
            <LayoutDashboard size={17} />
            {!collapsed && "Dashboard"}
          </NavLink>
          <NavLink
            to="/agent"
            className={({ isActive }) => cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
              isActive ? "bg-amber-50 text-amber-800" : "text-[#7c6e60] hover:bg-[#f5f0eb] hover:text-[#1c1917]"
            )}
          >
            <Mail size={17} />
            {!collapsed && "High Score (≥60%)"}
          </NavLink>
          <NavLink
            to="/low-score"
            className={({ isActive }) => cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
              isActive ? "bg-amber-50 text-amber-800" : "text-[#7c6e60] hover:bg-[#f5f0eb] hover:text-[#1c1917]"
            )}
          >
            <TrendingDown size={17} />
            {!collapsed && "Low Score (<60%)"}
          </NavLink>
          <NavLink
            to="/ignored-agent"
            className={({ isActive }) => cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
              isActive ? "bg-amber-50 text-amber-800" : "text-[#7c6e60] hover:bg-[#f5f0eb] hover:text-[#1c1917]"
            )}
          >
            <Ban size={17} />
            {!collapsed && "Improper Extraction"}
          </NavLink>
          <NavLink
            to="/companies"
            className={({ isActive }) => cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
              isActive ? "bg-amber-50 text-amber-800" : "text-[#7c6e60] hover:bg-[#f5f0eb] hover:text-[#1c1917]"
            )}
          >
            <Building2 size={17} />
            {!collapsed && "Company Info"}
          </NavLink>
        </nav>

        {!collapsed && (
          <div className="px-4 py-3 border-t border-[#ede3da] text-[11px] text-[#b8ae9e]">
            OpenRouter · Gemini Flash
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-[#fcfaf8]">
        <div className="mx-auto p-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
