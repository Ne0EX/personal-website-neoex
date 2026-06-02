"use client";

/**
 * FilmSimSwitcher.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Client component. Renders 4 film-simulation palette buttons.
 *
 * Server/client split mechanism (per SHIP-PLAN §3 + Peat v3 #3):
 *   PhotoEntry.tsx (server) renders [data-photo-entry-root] with data-palette="base".
 *   This component (client) mutates that attribute imperatively on click:
 *     root.dataset.palette = sim
 *   Runs post-hydration (onClick is safe). No state lifted across the boundary;
 *   no client wrapper around the server surface.
 *
 * D2 resolved: NETRA voice text element is targeted via data-netra-voice-text
 *   (a stable data-attribute set in PhotoEntry.tsx on the .voice-body span).
 *   This is the deterministic selector chosen to avoid class mangling and
 *   DOM structure brittleness.
 *
 * D4 resolved (Betelgeuse spec): opacity-dip 80ms + 80ms + 180ms fallback.
 *   Timer stored in module-level ref and cancelled on every new click to
 *   prevent timer pile-up during rapid switches.
 *
 * Atoms composed: attractor-pill-like controls (af-pill pattern from globals.css).
 *
 * Owner: Sirius (α-SUR-01) · TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP
 */

import { useCallback, useRef } from "react";

type FilmSim = "base" | "classic-chrome" | "acros" | "reala-ace" | "velvia";

// display  — full uppercase label for the switcher UI buttons.
// code     — NETRA instrument code (2-char, lowercase in strip context).
//            Vega (α-VOX-08) · TASK-2026-05-30-PHOTO-ENTRY-D3-NETRA-VOICE:
//            codes keep the L1 voice strip on one line at 375px.
//            Canonical in lib/netra/voice.md §7.
const SIMS: { id: FilmSim; label: string; display: string; code: string }[] = [
  { id: "base",           label: "Provia (base)",  display: "PROVIA",        code: "pr" },
  { id: "classic-chrome", label: "Classic Chrome", display: "CLASSIC CHROME", code: "cc" },
  { id: "acros",          label: "Acros",          display: "ACROS",         code: "ac" },
  { id: "reala-ace",      label: "Reala Ace",      display: "REALA ACE",     code: "ra" },
  { id: "velvia",         label: "Velvia",         display: "VELVIA",        code: "vv" },
];

export function FilmSimSwitcher() {
  // Module-level timer ref: cancelled on every new click to prevent pile-up
  // on rapid back-to-back switches (per SHIP-PLAN §3 + Peat v3 #C).
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyPalette = useCallback((sim: FilmSim) => {
    const root = document.querySelector<HTMLElement>("[data-photo-entry-root]");
    if (!root) return;

    // Cancel any in-flight fallback timer before starting a new cycle.
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    // D4: check prefers-reduced-motion — skip opacity-dip entirely if reduced.
    // Instant swap; no class added, no fallback timer needed.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReduced) {
      root.dataset.palette = sim;
      updateNetraVoice(sim);
      return;
    }

    // Opacity-dip sequence (D4 resolved):
    //   1. Add .is-palette-switching → body opacity dips to 0.75 in 80ms.
    //   2. On transitionend (or 180ms fallback): apply palette, update NETRA,
    //      remove class → opacity recovers to 1 in 80ms.
    //   Total: ~160ms perceivable.
    document.body.classList.add("is-palette-switching");

    // Listen for transitionend to remove the class after the dip completes.
    // Use { once: true } so the handler self-removes after firing once.
    const onTransitionEnd = (e: TransitionEvent) => {
      // Only respond to the opacity transition on body, not child elements.
      if (e.target !== document.body || e.propertyName !== "opacity") return;
      clearTimeout(fallbackTimerRef.current!);
      fallbackTimerRef.current = null;
      root.dataset.palette = sim;
      updateNetraVoice(sim);
      document.body.classList.remove("is-palette-switching");
    };

    document.body.addEventListener("transitionend", onTransitionEnd, {
      once: true,
    });

    // 180ms fallback timer: guarantees class removal if transitionend
    // doesn't fire (browser quirk, rapid switch, or interrupted paint).
    // Per Betelgeuse spec: 80ms dip + 80ms recovery + ~20ms buffer = 180ms.
    fallbackTimerRef.current = setTimeout(() => {
      document.body.removeEventListener("transitionend", onTransitionEnd);
      root.dataset.palette = sim;
      updateNetraVoice(sim);
      document.body.classList.remove("is-palette-switching");
      fallbackTimerRef.current = null;
    }, 180);
  }, []);

  return (
    <div
      role="group"
      aria-label="Film simulation palette"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        marginTop: "12px",
      }}
    >
      {/* Section header — INSTRUMENT register */}
      <div
        aria-hidden
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          paddingBottom: "8px",
          borderBottom: "1px dashed var(--ink-dashed)",
          marginBottom: "4px",
        }}
      >
        § FILM SIM
      </div>

      {SIMS.map(({ id, label, display }) => (
        <button
          key={id}
          type="button"
          aria-label={`Apply ${label} film simulation`}
          onClick={() => applyPalette(id)}
          style={{
            appearance: "none",
            background: "transparent",
            border: "1px solid var(--ink-faint)",
            color: "var(--ink-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            padding: "0.6em 0.9em",
            cursor: "pointer",
            textAlign: "left",
            /* Explicit transition for hover feedback — no animation, just state */
            transition:
              "border-color 150ms ease, color 150ms ease, background 150ms ease",
            /* Minimum 44px touch target height per a11y floor */
            minHeight: "44px",
          }}
          /* Focus-visible ring provided by the global ::selection / browser default.
             Augmented below via onFocus/onBlur is a no-op here; we rely on
             CSS :focus-visible from globals, which is acceptable since there's no
             module-scoped style sheet here. The outline is browser-native orange. */
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = "var(--accent-orange)";
            el.style.color = "var(--accent-orange)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = "var(--ink-faint)";
            el.style.color = "var(--ink-primary)";
          }}
        >
          {display}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NETRA voice text update — imperative DOM mutation (same pattern as root)
//
// D2 resolved: the voice text span carries data-netra-voice-text (set in
// PhotoEntry.tsx). This selector is stable against class renames and JSX
// restructuring. We find it, then update its text content.
//
// When sim !== 'base': appends instrument code as "· <code>" (e.g. "· cc").
// When sim === 'base': reverts to the base locus text.
//
// Vega (α-VOX-08) · TASK-2026-05-30-PHOTO-ENTRY-D3-NETRA-VOICE:
// Extension changed from "(borrowed eye · CLASSIC CHROME)" to "· cc" —
// instrument-code register, lowercase, fits 375px in one line.
// ─────────────────────────────────────────────────────────────────────────────
function updateNetraVoice(sim: FilmSim) {
  const voiceEl = document.querySelector<HTMLElement>(
    "[data-netra-voice-text]"
  );
  if (!voiceEl) return;

  // Base locus text is stored in a data attribute so we can always revert
  // without needing to reconstruct it.
  const baseLocus = voiceEl.dataset.netraBaseLocus ?? voiceEl.textContent ?? "";

  if (sim === "base") {
    voiceEl.textContent = baseLocus;
  } else {
    const code = SIMS.find((s) => s.id === sim)?.code ?? sim.toLowerCase();
    // Append instrument code in accent color. No parentheses, no "borrowed eye" phrase —
    // the code IS the instrument signal. innerHTML is safe: code is enum-bounded.
    voiceEl.innerHTML =
      `${escapeHtml(baseLocus)}` +
      `<span style="color:var(--accent-orange)"> · ${escapeHtml(code)}</span>`;
  }
}

/** Minimal HTML escape for the controlled displayName string. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
