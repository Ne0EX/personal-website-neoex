"use client";

import { useEffect, useState } from "react";

/**
 * LocaleSwitcher — top-right TH / EN locale toggle.
 *
 * Spec: SPEC-2026-06-18-bilingual-translation-group.md §6.3
 * Slice: P6b (Sirius, α-SUR-01)
 *
 * Placement: rendered inside the .nav-clock cell in Nav.tsx, below the
 * SYS // CALIBRATED + UTC+7 // HH:MM lines, alongside StratumIndicator.
 *
 * DESIGN CONTRACT
 * - Visual: t-meta mono register (9px, var(--font-mono), letter-spacing 0.3em,
 *   uppercase). The switch is a CONTROL, not translated chrome — it stays in
 *   the English-register instrument style even on /th pages (DL3, §6.3).
 * - Current locale emphasized at full --ink-primary; the other at --ink-soft.
 * - PD1 animation: instant label crossfade ~120ms opacity; the navigation
 *   itself is a hard window.location reload (locale resolved server-side by proxy).
 * - prefers-reduced-motion: skip opacity crossfade, swap immediately.
 *
 * LOCALE DETECTION
 * - Determined client-side from the URL pathname (hydration-safe: read in
 *   useEffect, not on initial render).
 * - /th/* or /th exactly → locale "th"; anything else → locale "en".
 *
 * COOKIE (PD2): wl_locale, Path=/, Max-Age=31536000, SameSite=Lax, NOT HttpOnly
 * (client must be able to set it). The proxy reads this cookie and it beats geo.
 *
 * PATH LOGIC (en-unprefixed, th-prefixed per DL2):
 * - Choose TH: cookie ← "th"; navigate to "/th" + currentUnprefixedPath.
 *   currentUnprefixedPath = pathname with any leading "/th" stripped.
 * - Choose EN: cookie ← "en"; navigate to currentPathWithThStripped.
 *   e.g. /th/articles/002 → /articles/002
 *        /th → /
 *        /articles/002 → /articles/002 (already unprefixed)
 *
 * A11Y
 * - role="group" on the container; each button has aria-label and aria-pressed.
 * - Keyboard reachable; visible focus ring via :focus-visible.
 * - aria-live="polite" on the container announces locale changes.
 *
 * HYDRATION SAFETY
 * - locale state starts null (renders nothing on server / first paint).
 * - useEffect sets it from window.location.pathname.
 * - No Date.now(), Math.random(), localStorage, or sessionStorage in render.
 */

type Locale = "en" | "th";

/** Strip a leading /th prefix and return the bare path (always starts with /). */
function stripThPrefix(pathname: string): string {
  if (pathname === "/th") return "/";
  if (pathname.startsWith("/th/")) return pathname.slice(3); // "/th/x" → "/x"
  return pathname;
}

/** Derive the current locale from window.location.pathname. */
function localeFromPathname(pathname: string): Locale {
  return pathname === "/th" || pathname.startsWith("/th/") ? "th" : "en";
}

export function LocaleSwitcher() {
  // null = server render / pre-hydration; never read window in render.
  const [locale, setLocale] = useState<Locale | null>(null);
  // Drives the 120ms opacity crossfade per PD1.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Hydration-safe: read window.location only inside useEffect (client-only).
    const detected = localeFromPathname(window.location.pathname);
    // Defer both state updates one tick so the initial render never flashes a
    // stale label and React does not cascade-render from the effect body.
    const t = setTimeout(() => {
      setLocale(detected);
      setVisible(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function handleSwitch(target: Locale) {
    if (target === locale) return; // already on this locale

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const fadeDuration = prefersReduced ? 0 : 120;

    // PD2 cookie: wl_locale, 1-year, Lax, not HttpOnly (client-settable).
    document.cookie = `wl_locale=${target}; Path=/; Max-Age=31536000; SameSite=Lax`;

    // Compute destination URL.
    const rawPath = window.location.pathname;
    const search = window.location.search;
    let dest: string;

    if (target === "th") {
      // Unprefixed path (strip any existing /th, then add /th prefix).
      const unprefixed = stripThPrefix(rawPath);
      dest = "/th" + (unprefixed === "/" ? "" : unprefixed) + search;
    } else {
      // EN: strip /th prefix.
      const stripped = stripThPrefix(rawPath);
      dest = stripped + search;
    }

    if (fadeDuration === 0) {
      // prefers-reduced-motion: instant navigate, no crossfade.
      window.location.href = dest;
      return;
    }

    // PD1 crossfade: fade out labels, then navigate.
    setVisible(false);
    const t = setTimeout(() => {
      window.location.href = dest;
    }, fadeDuration);

    // Cleanup: if the component unmounts before the timeout fires (e.g. during
    // fast double-click) the navigation is already committed — safe to let it run.
    // We do not clear this timer on unmount intentionally so the navigate fires.
    // (clearTimeout on unmount would silently swallow the nav on rapid switch.)
    return () => clearTimeout(t);
  }

  // Render nothing until locale is known (no SSR flash, no hydration mismatch).
  if (locale === null) return null;

  return (
    <span
      role="group"
      aria-label="Language switch"
      aria-live="polite"
      style={{
        opacity: visible ? 1 : 0,
        // 120ms per PD1. CSS transition means setVisible(false) triggers fade.
        transition: "opacity 120ms ease",
        display: "inline-flex",
        alignItems: "baseline",
        gap: "0.35em",
        // Inherit the t-meta register from the parent nav-clock cell.
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        // Not a block element — flows naturally beside StratumIndicator.
        whiteSpace: "nowrap",
      }}
    >
      <LocaleButton
        label="TH"
        active={locale === "th"}
        onClick={() => handleSwitch("th")}
      />
      <span
        aria-hidden="true"
        style={{ color: "var(--ink-soft)", letterSpacing: 0 }}
      >
        ·
      </span>
      <LocaleButton
        label="EN"
        active={locale === "en"}
        onClick={() => handleSwitch("en")}
      />
    </span>
  );
}

/** Single TH or EN button. Active locale = --ink-primary; inactive = --ink-soft. */
function LocaleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Switch to ${label === "TH" ? "Thai" : "English"}`}
      aria-pressed={active}
      onClick={onClick}
      style={{
        // Reset all button chrome.
        appearance: "none",
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        cursor: active ? "default" : "pointer",
        // Typography inherits from the parent LocaleSwitcher span.
        fontFamily: "inherit",
        fontSize: "inherit",
        letterSpacing: "inherit",
        textTransform: "inherit",
        // ctl-text: active = --ctl-text-fg-active (ink-primary); inactive = --ctl-text-fg (ink-soft).
        color: active ? "var(--ctl-text-fg-active)" : "var(--ctl-text-fg)",
        // Hover lifts inactive to --ctl-text-fg-hover (accent-orange); active stays on active token.
        transition: "color 120ms ease",
        // Touch-target enlargement is scoped to mobile ONLY via .nav-slim-locale button
        // in globals.css (min-height:44px, min-width:36px, display:flex, align-items:center).
        // That rule only has visual effect inside .nav-slim (display:none >600px), so
        // desktop is never bloated. Do NOT add minHeight/paddingBlock here — that was
        // the prior all-viewport regression (Peat reject). CSS class = the right lever.
        // Visible focus ring — do not suppress. Browser :focus-visible is
        // sufficient here (no outline: none anywhere).
        outlineOffset: "2px",
        lineHeight: 1,
        userSelect: "none",
        // Disable pointer on the active locale button (already selected).
        pointerEvents: active ? "none" : "auto",
      }}
      onMouseEnter={(e) => {
        // F4: touch-gate — only apply hover colour on true pointer devices.
        // onMouseEnter fires on touch tap on iOS/Android, producing a stuck
        // accent-orange state. The matchMedia guard prevents that.
        if (!active && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          /* ctl-text hover: --ctl-text-fg-hover (accent-orange) */
          e.currentTarget.style.color = "var(--ctl-text-fg-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          /* ctl-text rest: --ctl-text-fg (ink-soft) */
          e.currentTarget.style.color = "var(--ctl-text-fg)";
        }
      }}
    >
      {label}
    </button>
  );
}
