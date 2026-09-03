"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Global top loading bar (YouTube-style). Driven by a lightweight custom
 * event bus: any fetch tracked by `installGlobalFetchTracker()` bumps a
 * pending counter and dispatches `app:load`, so every data load across the
 * app (SWR, raw fetch, pagination) shows the bar automatically.
 */

export const LOAD_EVENT = "app:load";

export function notifyLoading(pending: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LOAD_EVENT, { detail: { pending } }));
}

/** Installs a global fetch wrapper that tracks in-flight requests. */
export function installGlobalFetchTracker() {
  if (
    typeof window === "undefined" ||
    (window as { __appLoadingTracker?: boolean }).__appLoadingTracker
  ) {
    return;
  }
  (window as { __appLoadingTracker?: boolean }).__appLoadingTracker = true;
  let pending = 0;

  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    pending += 1;
    notifyLoading(pending);
    try {
      return await origFetch(...args);
    } finally {
      pending = Math.max(0, pending - 1);
      notifyLoading(pending);
    }
  };
}

export default function LoadingBar() {
  const [active, setActive] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onLoad = (e: Event) => {
      const pending = (e as CustomEvent<{ pending: number }>).detail?.pending ?? 0;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (pending > 0) {
        setActive(true);
      } else {
        // Brief tail so fast loads still register a subtle flash.
        hideTimer.current = setTimeout(() => setActive(false), 200);
      }
    };
    window.addEventListener(LOAD_EVENT, onLoad);
    return () => {
      window.removeEventListener(LOAD_EVENT, onLoad);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2px] overflow-hidden">
      {/* sliding indeterminate bar */}
      <div className="h-full w-1/3 animate-loadingbar bg-claude-accent" />
    </div>
  );
}
