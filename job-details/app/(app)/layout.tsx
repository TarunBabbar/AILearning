"use client";

import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import SWRProvider from "@/components/SWRProvider";
import LoadingBar, { installGlobalFetchTracker } from "@/components/LoadingBar";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Track every fetch so the global loading bar shows during data loads.
  useEffect(() => {
    installGlobalFetchTracker();
  }, []);

  return (
    <SWRProvider>
      <LoadingBar />
      <div className="flex h-screen overflow-hidden bg-[#f5f4ef]">
        <Sidebar />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
          {children}
        </main>
      </div>
    </SWRProvider>
  );
}
