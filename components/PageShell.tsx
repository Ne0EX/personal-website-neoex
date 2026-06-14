"use client";

import { useEffect, useState } from "react";
import { BootSequence } from "./BootSequence";

const STORAGE_KEY = "wl:boot-seen";

/**
 * BootOverlay — client-only overlay that shows the BootSequence on a genuine
 * first session visit and disappears once done.
 *
 * Architecture note (boot-footer fix, α-SUR-01, 2026-06-14):
 *
 *   Root constraint: the overlay must be client-only (no SSR) to avoid a
 *   hydration mismatch — sessionStorage doesn't exist on the server, so the
 *   server always renders nothing here and the client reconciles after mount.
 *
 *   The real root cause of "boot gone" was NOT a queueMicrotask timing issue —
 *   it was that BootSequence used `paper-canvas` on its fixed-positioned root
 *   div. `.paper-canvas { position: relative }` in globals.css overrode the
 *   Tailwind `fixed` class, collapsing the overlay into a relative block at the
 *   bottom of the page flow rather than covering the viewport. Fixed in
 *   BootSequence.tsx (boot-footer fix, α-SUR-01, 2026-06-14).
 *
 *   queueMicrotask is the codebase-standard pattern (see Nav.tsx, TriangulateSearch.tsx)
 *   for deferring setState out of the effect body to satisfy react-hooks/set-state-in-effect.
 *   sessionStorage is read synchronously before the queueMicrotask so the value
 *   is captured in the same task as the effect.
 *
 *   bfcache safety: children are ALWAYS rendered as the base layer (see PageShell
 *   below). The overlay is purely additive — a position:fixed opaque cover on top
 *   during boot. bfcache always captures real content underneath, never blank.
 *
 *   Hydration safety: `show` starts `null` on server and first client render
 *   (both render nothing), so SSR HTML matches. The useEffect fires after mount
 *   (client-only) and sets `show` via queueMicrotask.
 */
function BootOverlay() {
  // null = server / not yet mounted. true = first visit, show boot. false = skip.
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    // queueMicrotask defers setState out of the effect body, satisfying the
    // react-hooks/set-state-in-effect rule (per Nav.tsx / TriangulateSearch.tsx
    // codebase pattern), while reading sessionStorage synchronously before the
    // microtask so the value is captured in the same task as the effect.
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
 * Children are ALWAYS rendered (never blanked) — bfcache captures real content.
 * BootOverlay sits above children as a fixed opaque layer during the boot play.
 */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BootOverlay />
    </>
  );
}
