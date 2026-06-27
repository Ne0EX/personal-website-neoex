"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useStratumKey, type StratumKey } from "@/lib/client-state/globe-store";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useThemeMode, toggleThemeMode } from "@/lib/useThemeMode";

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
        // Separator gap — only when a label is shown, so the empty (stratum=all)
        // state has zero width and the clock above stays flush right.
        marginLeft: displayLabel ? "0.75rem" : 0,
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

  // S3 · slim bar menu toggle state.
  // is-open class on .nav-slim drives the CSS-only panel expand (max-height).
  const [menuOpen, setMenuOpen] = useState(false);
  const themeMode = useThemeMode();

  // Close the menu when the route changes (e.g. visitor taps a section link
  // then presses browser back and the component is still mounted).
  const pathname = usePathname();
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Desktop nav — visible >600px, hidden ≤600px by Betelgeuse CSS ── */}
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
        {/*
          P6b (Sirius, α-SUR-01) — LocaleSwitcher added as a third row in
          the nav-clock cell, below UTC+7 // HH:MM + StratumIndicator.
          The switcher is a control, not translated chrome — it stays in the
          English-register t-meta instrument style per SPEC-2026-06-18 §6.3 / DL3.
          flex justify-end keeps it right-aligned to match the rest of nav-clock.
          suppressHydrationWarning: LocaleSwitcher renders null until useEffect
          reads window.location (client-only), so no SSR/client mismatch.
        */}
        <div className="nav-clock t-meta">
          <div>SYS {"//"} CALIBRATED</div>
          <div
            className="flex justify-end items-baseline"
            suppressHydrationWarning
          >
            <span>{`UTC+7 // ${time}`}</span>
            {/* gap moved off the flex container onto the indicator itself: when
                the stratum is "all" the indicator renders empty, and a flex
                `gap` would still reserve trailing space — shoving the clock 12px
                off the right edge. A conditional margin keeps the clock flush
                right by default and only adds the separator gap when a stratum
                label is actually shown. */}
            <StratumIndicator />
          </div>
          <div className="flex justify-end items-baseline" suppressHydrationWarning>
            <LocaleSwitcher />
          </div>
        </div>
      </div>

      {/*
        S3 · Slim bar — visible ≤600px, hidden >600px by Betelgeuse CSS.
        Both structures always render in the DOM so the CSS toggle is pure
        CSS (no JS breakpoint) — zero hydration flash.

        .nav-slim.is-open: adds is-open to the root when menuOpen is true,
        which the pre-written CSS uses to expand .nav-slim-menu (max-height).

        Clock/stratum readout: reuses the same `time` state from the shared
        setInterval above — both bars stay in sync without a second interval.
        StratumIndicator is a separate instance but reads the same store value
        (useStratumKey) so they remain in sync.
      */}
      <div className={`nav-slim${menuOpen ? " is-open" : ""}`}>
        {/* Single-row inner bar */}
        <div className="nav-slim-bar">
          {/* Wordmark — left */}
          <a href="/" className="nav-slim-wordmark">
            ∇ NEOSPIRIT
          </a>

          {/*
            Centre readout — reuses `time` state (same interval as desktop bar).
            suppressHydrationWarning: time is "--:--" on SSR, real value after
            useEffect, same pattern as desktop nav-clock.
          */}
          <div className="nav-slim-readout" suppressHydrationWarning>
            {`UTC+7 // ${time}`}
          </div>

          {/* Right cluster: locale + search + menu */}
          <div className="nav-slim-actions">
            {/*
              Locale switcher wrapper — .nav-slim-locale scopes the CSS tap-target
              override (.nav-slim-locale button { min-height: 44px }) written by
              Betelgeuse. suppressHydrationWarning: LocaleSwitcher renders null
              until useEffect reads window.location (same pattern as desktop).
            */}
            <div className="nav-slim-locale" suppressHydrationWarning>
              <LocaleSwitcher />
            </div>

            {/* Theme toggle — ◆ night / ○ day. Mirrors the desktop REGISTER
                panel; both write the same data-theme via setThemeMode. */}
            <button
              type="button"
              className="nav-slim-theme"
              aria-label="Toggle dark mode"
              aria-pressed={themeMode === "dark"}
              onClick={() => toggleThemeMode()}
              suppressHydrationWarning
            >
              <span aria-hidden="true">{themeMode === "dark" ? "◆" : "○"}</span>
            </button>

            {/* Search glyph — dispatches triangulate:open; TriangulateSearchPortal listens */}
            <button
              type="button"
              className="nav-slim-search"
              aria-label="OPEN GLOBAL SEARCH"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("triangulate:open"))
              }
            >
              <span aria-hidden="true">⌖</span>
            </button>

            {/* Menu glyph — toggles the collapsible links panel */}
            <button
              type="button"
              className="nav-slim-menu-btn"
              aria-label={menuOpen ? "CLOSE SECTION MENU" : "OPEN SECTION MENU"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span aria-hidden="true">☰</span>
            </button>
          </div>
        </div>

        {/*
          Collapsible links panel — CSS-driven open/close via .nav-slim.is-open
          (max-height: 0 → 320px). Position:absolute so it overlays content
          below the bar rather than pushing the page layout.
          aria-label announces to SR that this is the site sections nav.
          Links close the menu onClick so the panel collapses after navigation.
        */}
        <nav className="nav-slim-menu" aria-label="SITE SECTIONS">
          <div className="nav-slim-menu-inner">
            {NAV_ITEMS.map(({ label, href: navHref }) => (
              <a
                key={label}
                href={navHref}
                className="nav-slim-link"
                onClick={() => setMenuOpen(false)}
              >
                ◇ {label}
              </a>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
