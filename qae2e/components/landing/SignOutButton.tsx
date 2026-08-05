"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <button
      onClick={signOut}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-red-600 px-2 py-1.5 rounded-md transition-colors"
    >
      <LogOut size={14} /> Sign out
    </button>
  );
}
