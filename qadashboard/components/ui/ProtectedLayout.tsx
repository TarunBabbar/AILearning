"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SidebarProvider } from "@/lib/sidebar-context";
import { Sidebar } from "@/components/ui/Sidebar";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      window.location.href = "/login";
    }
  }, [loading, user, isLoginPage]);

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-bg-page">
        <Loader2 size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="h-full flex">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
