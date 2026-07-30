"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
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

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-bg-page">
        <Loader2 size={32} className="animate-spin text-amber-500" />
      </div>
    );
  }

  // Login page renders without sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Not authenticated — render nothing (redirect will fire)
  if (!user) {
    return null;
  }

  // Authenticated — render dashboard layout
  return <>{children}</>;
}
