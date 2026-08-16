"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Settings as SettingsIcon, User, Plug, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoader } from "@/components/ui/PageLoader";
import { AppFooter } from "@/components/ui/AppFooter";
import { UserMenu } from "@/components/ui/UserMenu";
import { AccountTab } from "@/components/settings/AccountTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";

type TabKey = "account" | "integrations";

const TABS: Array<{ key: TabKey; label: string; icon: typeof User }> = [
  { key: "account", label: "Account", icon: User },
  { key: "integrations", label: "Integrations", icon: Plug },
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-text-muted">Loading settings…</div>}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") || "";

  const [me, setMe] = useState<{ id: string; email: string; name?: string } | null | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>(() => {
    const t = searchParams.get("tab");
    return (t === "account" || t === "integrations" ? t : "account") as TabKey;
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const d = await res.json();
        if (!d.user) {
          router.replace("/login");
          return;
        }
        setMe(d.user);
      } catch {
        setMe(null);
      }
    })();
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  };

  if (me === undefined) {
    return <PageLoader label="Loading settings…" />;
  }

  const pick = (t: TabKey) => {
    setTab(t);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", t);
    router.replace(`/settings?${sp.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-bg-page/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 h-[64px] flex items-center gap-4">
          <Link href="/workspaces" className="flex items-center gap-2 font-bold text-text-primary">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-white">
              <Sparkles size={15} />
            </span>
            QAE2E
          </Link>
          <span className="text-sm text-text-muted hidden md:inline">Settings</span>
          <div className="ml-auto flex items-center gap-2.5">
            <Link
              href={workspaceId ? `/workspace?workspaceId=${encodeURIComponent(workspaceId)}` : "/workspaces"}
              className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg border border-border text-text-secondary text-sm font-semibold hover:bg-bg-hover transition-colors"
            >
              <ChevronLeft size={14} /> Workspace
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 min-h-9 px-4 rounded-lg bg-amber-500 text-white text-sm font-semibold shadow-sm hover:bg-amber-600 transition-colors"
            >
              <Sparkles size={14} /> Home
            </Link>
            {me && (
              <UserMenu name={me.name} email={me.email} onLogout={logout} />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon size={20} className="text-amber-600" />
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          {workspaceId && (
            <span className="text-sm text-text-muted ml-2">— workspace {workspaceId.slice(0, 8)}</span>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-4 mb-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => pick(t.key)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                  tab === t.key
                    ? "bg-amber-500/10 text-amber-700 border border-amber-500/40"
                    : "text-text-secondary hover:bg-bg-hover border border-transparent"
                )}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "account" && <AccountTab />}
        {tab === "integrations" && <IntegrationsTab workspaceId={workspaceId} />}
      </main>
      <AppFooter />
    </div>
  );
}
