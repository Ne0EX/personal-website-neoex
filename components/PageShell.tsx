"use client";

import { useEffect, useState } from "react";
import { BootSequence } from "./BootSequence";

const STORAGE_KEY = "wl:boot-seen";

/**
 * PageShell — runs the boot sequence on first visit, gates content reveal.
 * Subsequent navigations within the session skip boot.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  const [booted, setBooted] = useState<boolean | null>(null);

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
