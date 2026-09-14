"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { BOOT_STORAGE_KEY, BootSequence } from "./BootSequence";

function readBootSeen(): boolean {
  try {
    return Boolean(sessionStorage.getItem(BOOT_STORAGE_KEY));
  } catch {
    return false;
  }
}

function subscribeBootSeen(onChange: () => void): () => void {
  window.addEventListener("pageshow", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("pageshow", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function pendingBootSnapshot(): null {
  return null;
}

/**
 * The server and hydration both render an inactive cover. A parser-time session
 * check in BootSequence hides it for returning visitors before content paints.
 * Like ArchiveMiniGlobe's browser-capability store, the client snapshot is read
 * after hydration, but immediately on later client navigations. That avoids
 * replaying even the pending cover when a seen session opens another page.
 */
function BootOverlay() {
  const seen = useSyncExternalStore(
    subscribeBootSeen,
    readBootSeen,
    pendingBootSnapshot,
  );
  const [completed, setCompleted] = useState(false);
  const finish = useCallback(() => {
    try {
      sessionStorage.setItem(BOOT_STORAGE_KEY, "1");
    } catch {
      // Persistence is optional; blocked storage must not strand the cover.
    }
    setCompleted(true);
  }, []);

  if (completed || seen === true) return null;

  return <BootSequence active={seen === false} onDoneAction={finish} />;
}

/**
 * PageShell — wraps page content so the boot sequence overlays on first visit.
 * Children are ALWAYS rendered (never blanked) — bfcache captures real content.
 * BootOverlay sits above children as a fixed opaque layer during the boot play.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BootOverlay />
      {children}
    </>
  );
}
