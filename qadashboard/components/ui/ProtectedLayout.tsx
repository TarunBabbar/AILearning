"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SidebarProvider } from "@/lib/sidebar-context";
import { Sidebar } from "@/components/ui/Sidebar";
import { ShellSkeleton } from "@/components/ui/Skeleton";
import { useEffect } from "react";

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isPublicPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (!loading && !user && !isPublicPage) {
      router.replace("/login");
    }
  }, [loading, user, isPublicPage, router]);

  // Public pages — never block
  if (isPublicPage) {
    return <>{children}</>;
  }

  // First visit with no cached user — show a shell skeleton, not a bare spinner
  if (loading && !user) {
    return <ShellSkeleton />;
  }

  if (!user) {
    return null;
  }

  // Authenticated shell stays mounted across tab navigations
  return (
    <SidebarProvider>
      <div className="h-full flex">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-auto">{children}</main>
      </div>
    </SidebarProvider>
  );
}
