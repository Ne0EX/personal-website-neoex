"use client";

import { useEffect, useState } from "react";
import { BootSequence } from "./BootSequence";

const STORAGE_KEY = "wl:boot-seen";

/**
 * BootOverlay — client-only overlay that shows the BootSequence on a genuine
 * first session visit and disappears once done.
 *
 * Architecture note (bfcache-fix #3, 2026-06-14):
 *   The previous approach gated CHILDREN behind a `booted === null` blank
 *   placeholder. bfcache captures the page as-frozen when the user navigates
 *   away. If the blank placeholder was on screen at freeze time, back-nav
 *   restores the blank → white page.
 *
 *   Root fix: children are ALWAYS rendered as the base layer. This component
 *   is purely additive — it mounts a position:fixed overlay on top when
 *   sessionStorage says it's a first visit, then dismisses to reveal the
 *   content underneath. bfcache always captures real content, never blank.
 *
 *   Hydration safety: `mounted` starts false (server renders nothing here),
 *   set to true in useEffect. The overlay is therefore client-only and never
 *   causes a hydration mismatch. Children are rendered identically on server
 *   and client.
 */
function BootOverlay() {
  // `null` = not yet mounted (server / first client paint), avoids hydration
  // mismatch. `true` = show boot overlay. `false` = already seen, skip.
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    // queueMicrotask defers the setState out of the effect body, satisfying the
    // react-hooks/set-state-in-effect rule while still reading sessionStorage
    // synchronously (so the value is captured before any concurrent update).
    const seen = sessionStorage.getItem(STORAGE_KEY);
    queueMicrotask(() => setShow(seen ? false : true));
  }, []);

  if (show !== true) return null;

  return (
    <BootSequence
      onDoneAction={() => {
        sessionStorage.setItem(STORAGE_KEY, "1");
        setShow(false);
      }}
    />
  );
}

/**
 * PageShell — wraps page content so the boot sequence overlays on first visit.
 * Children are always rendered (never blanked), making this safe for bfcache.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BootOverlay />
    </>
  );
}
