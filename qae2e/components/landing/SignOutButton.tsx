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
      className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 transition-colors"
    >
      <LogOut size={14} /> Sign out
    </button>
  );
}
