"use client";

// Client wrapper for the UserMenu used by server-rendered pages (landing
// header). Fetches the current user and renders the avatar dropdown.

import { useEffect, useState } from "react";
import { UserMenu } from "@/components/ui/UserMenu";

export function HeaderUserMenu() {
  const [me, setMe] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const d = await res.json();
        if (d.user) setMe(d.user);
      } catch {
        // no session
      }
    })();
  }, []);

  if (!me) return null;
  return <UserMenu name={me.name} email={me.email} />;
}
