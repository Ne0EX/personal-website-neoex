"use client";

import { useEffect, useState } from "react";
import { BootSequence } from "./BootSequence";

const STORAGE_KEY = "wl:boot-seen";

/**
 * PageShell — runs the boot sequence on first visit, gates content reveal.
 * Subsequent navigations within the session skip boot.
 *
 * bfcache fix (#3, 2026-06-14):
 *   Next.js App Router pages restored from the browser's back-forward cache
 *   (bfcache) do NOT re-run React effects — the client tree is frozen at the
 *   state it had when the user navigated away. If PageShell was rendering its
 *   blank `booted === null` placeholder (briefly, during first hydration), that
 *   blank div is what bfcache captures and restores — producing a white page
 *   on back-nav.
 *
 *   Fix: attach a `pageshow` listener. When `event.persisted === true` (bfcache
 *   restore), call `location.reload()` to force a fresh render. This is the
 *   correct escape hatch for Next.js App Router + bfcache when client state
 *   would otherwise be stale.
 *
 *   The reload is imperceptible in practice: bfcache restore + reload is
 *   ~identical latency to a fresh navigation since the page assets are cached.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  const [booted, setBooted] = useState<boolean | null>(null);

  // bfcache restore guard — reload on back/forward nav to ensure React
  // effects re-run and the page renders correctly (not the frozen blank state).
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        location.reload();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    const seen = sessionStorage.getItem(STORAGE_KEY);
    queueMicrotask(() => setBooted(seen ? true : false));
  }, []);

  if (booted === null) {
    return <div className="paper-canvas min-h-screen" aria-hidden />;
  }

  if (!booted) {
    return (
      <BootSequence
        onDoneAction={() => {
          sessionStorage.setItem(STORAGE_KEY, "1");
          setBooted(true);
        }}
      />
    );
  }

  return <>{children}</>;
}
