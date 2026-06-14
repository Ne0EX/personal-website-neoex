"use client";

import { useEffect, useState } from "react";
import { useStratumKey, type StratumKey } from "@/lib/client-state/globe-store";

// ARCHIVE is a real route link per docs/design/21-archive-route.md §0 + §2.
// Peat directive 2026-06-01 overrides VISION-2026-05-31 §1.1 Π1:
// ◇ ARCHIVE navigates to /archive (real <a>). The triangulate:open dispatch is removed.
//
// Audit fix (2.E): bare fragment hrefs (#hero, #index, #transmit) only work on
// the home page where those ids exist. From entry pages (/articles/*, /photos/*,
// /fiction/*) they become dead anchors that yank scroll to top. Using root-anchored
// hrefs (/#hero, /#index, /#transmit) ensures they navigate back to home AND scroll
// to the correct section from any route.
//
// Audit fix (2.E Nav ARCHIVE active-state dead code): Nav.tsx:153 checked
// pathname === '/archive' but Nav never mounts on /archive (the archive page
// renders its own OBSERVATORY header without Nav). The isArchive/active-state
// logic is dead wherever Nav mounts. Removing it — no behaviour change, cleaner code.
// FRAMES → /photos added per feedback #1 (2026-06-14): visitors had no discoverable
// route to the photo gallery. Placed between TRACES and ARCHIVE so it sits in the
// natural reading-depth sequence: identity → film traces → archive → contact.
const NAV_ITEMS = [
  { label: "INDEX",     href: "/#hero"    },
  { label: "TRACES",    href: "/#index"   },
  { label: "FRAMES",    href: "/photos"   },
  { label: "ARCHIVE",   href: "/archive"  },
  { label: "TRANSMIT",  href: "/#transmit"},
];

/**
 * Maps a StratumKey to the display label shown in the Nav indicator.
 * Per journey-arch §3.6: "all" → hidden (no indicator); others → display key.
 */
const STRATUM_LABEL: Record<StratumKey, string | null> = {
  all:  null,   // default — no indicator (spec §3.6 rationale)
  nex:  "NeX",
  neon: "Ne0N",
  neo:  "Ne0",
};

function fmtTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * StratumIndicator — renders "· STRATUM Ne0" (or NeX / Ne0N) in the Nav
 * right-side readout zone when the visitor has left the default ALL stratum.
 *
 * Spec source: journey-architecture.md v1.2 §3.6
 *
 * Visual contract:
 *   - t-mono, 9px, UPPERCASE, letter-spacing 0.3em, color var(--ink-soft)
 *   - 200ms opacity transition on stratum change (defer-set → CSS fade)
 *   - NOT clickable — display only; left rail is the click target
 *   - Invisible (opacity 0) when stratum is "all" (default needs no label)
 *
 * A11y:
 *   - role="status" + aria-live="polite" announces stratum changes
 *   - Element stays mounted so screen readers receive change events without
 *     a DOM insertion event (avoids announcement suppression in some SRs)
 *   - aria-hidden set when invisible to prevent SR narrating hidden state
 *
 * Animation strategy:
 *   Two setTimeout callbacks (both async, never synchronous setState in the
 *   effect body — satisfies react-hooks/set-state-in-effect lint rule).
 *   Phase 1 (0ms): setIsVisible(false) → CSS transition fades opacity to 0.
 *   Phase 2 (200ms): swap displayLabel + set isVisible per new label.
 *   prefers-reduced-motion: phase 2 delay collapses to 0ms (instant swap).
 */
function StratumIndicator() {
  const stratum = useStratumKey();
  const targetLabel = STRATUM_LABEL[stratum];

  // displayLabel is what is currently shown in the DOM (may lag targetLabel).
  const [displayLabel, setDisplayLabel] = useState<string | null>(null);
  // isVisible controls CSS opacity — false triggers the CSS fade-out.
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Read prefers-reduced-motion inside the effect (client-only, hydration-safe).
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const fadeDuration = reducedMotion ? 0 : 200;

    // Phase 1 (deferred 0ms): begin CSS fade-out by toggling isVisible.
    // Using setTimeout ensures this is not a synchronous setState in the
    // effect body (satisfies react-hooks/set-state-in-effect).
    const t1 = setTimeout(() => {
      setIsVisible(false);
    }, 0);

    // Phase 2: after the fade-out completes, swap the text and fade in.
    const t2 = setTimeout(() => {
      setDisplayLabel(targetLabel);
      setIsVisible(targetLabel !== null);
    }, fadeDuration);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [targetLabel]);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      // aria-hidden when invisible prevents SR from narrating the hidden state.
      // When isVisible, the text content "· STRATUM X" is read naturally.
      aria-hidden={!isVisible}
      className="t-mono"
      style={{
        // 200ms opacity transition per §3.6. CSS transition on "opacity"
        // means the phase-1 setIsVisible(false) triggers an automatic fade.
        opacity: isVisible ? 1 : 0,
        transition: "opacity 200ms ease",
        // Instrument-dashboard text (§3.6): subordinate to NAV STANDBY.
        fontSize: "9px",
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: "var(--ink-soft)",
        // NOT clickable per §3.6.
        pointerEvents: "none",
        userSelect: "none",
        display: "inline",
      }}
    >
      {displayLabel ? `· STRATUM ${displayLabel}` : null}
    </span>
  );
}

export function Nav() {
  const [time, setTime] = useState<string>("--:--");
  useEffect(() => {
    const update = () => setTime(fmtTime(new Date()));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="nav-shell relative z-[3] section-rule">
      <div className="nav-id t-meta">
        {/*
         * CW-05 (name "· Peat" in nav-id) REVERTED by Polaris 2026-06-14 — surfacing the
         * real name in the persistent nav is an identity/aesthetic call that overlaps the
         * deferred NP-01 (about/resume signpost prominence) and the deliberate ∇ NEOSPIRIT /
         * Ne0EX persona mythology. Peat is building a separate about-me + resume.neoex.com for
         * the real-identity audience; whether his name belongs in the main-site nav is HIS call.
         * Deferred into NP-01 for his decision on return.
         */}
        <div>
          <span className="t-meta-accent">∇ NEOSPIRIT {"//"} WORLDLINE 1.130426</span>
        </div>
        <div className="mt-1.5 text-[var(--ink-soft)]">
          EST. 2026 — BANGKOK / THAILAND
        </div>
      </div>

      <nav className="nav-links t-meta">
        {NAV_ITEMS.map(({ label, href: navHref }) => (
          <a
            key={label}
            href={navHref}
            className="text-[var(--ink-primary)] hover:text-[var(--accent-orange)] transition-colors"
          >
            ◇ {label}
          </a>
        ))}
      </nav>

      {/*
        Right-side readout (nav-clock) — per journey-arch §3.6:
        SYS // CALIBRATED on the first line; time + stratum indicator on the
        second line. flex + justify-end keeps both right-aligned within the
        nav-clock text-align:right container. items-baseline aligns the
        9px mono indicator with the clock text.

        suppressHydrationWarning: the clock (Date.now()) resolves in useEffect
        so server and client render differ. suppressHydrationWarning on the
        div prevents the warning without hiding real bugs.
      */}
      <div className="nav-clock t-meta">
        <div>SYS {"//"} CALIBRATED</div>
        <div
          className="flex justify-end items-baseline gap-3"
          suppressHydrationWarning
        >
          <span>{`UTC+7 // ${time}`}</span>
          <StratumIndicator />
        </div>
      </div>
    </div>
  );
}
