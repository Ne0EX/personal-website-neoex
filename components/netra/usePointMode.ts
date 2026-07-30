"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getNode } from "@/lib/netra/archive";
import type { PointModeOverlayHandle } from "./PointModeOverlay";

/** Touch pick-flash duration — see netra-bay.css's `netra-point-flash` keyframe (0.45s, matched to this constant). */
const FLASH_MS = 450;

/** The bay dock is `[data-netra-root]` — its own controls (POINT/LOG/CLEAR LOG) must keep working while armed. */
function isInsideBay(target: EventTarget | null): boolean {
  return !!(target as Element | null)?.closest?.("[data-netra-root]");
}

/** Hit-test: nearest `[data-survey]` ancestor, skipping anything inside the bay dock. */
function surveySurfaceAt(target: EventTarget | null): Element | null {
  if (isInsideBay(target)) return null;
  return (target as Element | null)?.closest?.("[data-survey]") ?? null;
}

function labelFor(el: Element): string {
  const id = el.getAttribute("data-survey") ?? "";
  return el.getAttribute("data-survey-label") || getNode(id)?.label || "SURFACE";
}

export interface UsePointModeOptions {
  /** Called once a surface resolves — desktop click-hit or touch tap-hit. Never called on a miss. */
  onPick: (id: string, label: string) => void;
}

export interface UsePointModeResult {
  armed: boolean;
  /** POINT button onClick — flips armed on/off. */
  toggle: () => void;
  /** Escape (and any other programmatic disarm) — safe to call when already disarmed. */
  disarm: () => void;
  overlayRef: React.RefObject<PointModeOverlayHandle | null>;
}

/**
 * usePointMode — arms/disarms the survey reticle. Behavioral reference:
 * NETRA Bay.dc.html lines 166-226 (`setPoint`/`hoverAt`/`pick`), extended
 * per the S9 spec with a touch arm-then-tap flow the (desktop-only)
 * prototype never had.
 *
 * While armed, a `pointermove` + `click` capture pair lives on `document`
 * (added/removed by the effect below, keyed on `armed` — no listener sits
 * around while disarmed). Hit-testing always skips `[data-netra-root]` so
 * the bay's own POINT/LOG/CLEAR LOG buttons keep working mid-arm, exactly
 * like the prototype's `_ck`/`hoverAt` early-returns.
 *
 * `armed` is the ONLY React state here — it changes at most twice per
 * point-mode session (arm, then pick/ESC/paper-tap disarm). The hover path
 * itself never calls `setState`: `onPointerMove` writes the hit element
 * into a plain closure variable and schedules at most one
 * `requestAnimationFrame` callback, which reads that variable and pushes a
 * `getBoundingClientRect()` + a few style writes straight into
 * `PointModeOverlay` via `overlayRef.current.show()` — this is the S9 hard
 * rule ("ZERO setState on mousemove") satisfied by construction, not by
 * memoization.
 *
 * Desktop click: always `preventDefault`+`stopPropagation`s while armed
 * (outside the bay) so a link/`<summary>` under the reticle can never
 * activate — then either picks (hit) or disarms silently (miss), matching
 * the prototype's `setPoint(false)` unconditionally before the pick.
 *
 * Touch: detected per-event via `PointerEvent.pointerType === 'touch'`
 * (not a static `matchMedia` capability query — a hybrid device can have
 * both kinds of input, and only the event itself knows which one fired
 * it). A hit on `pointerup` flashes the overlay for `FLASH_MS` — skipped
 * under `prefers-reduced-motion: reduce`, which resolves the pick
 * immediately instead — then calls `onPick` and disarms; a miss (tap on
 * paper) disarms silently, no flash. The browser's own synthetic `click`
 * that follows a touch tap is still swallowed by the `click` listener
 * (armed stays true for the whole flash window specifically so that
 * click's `preventDefault` still lands on it), but `touchHandled` tells
 * that listener the pick was already resolved by `pointerup`, so a tap
 * never double-fires `onPick`.
 */
export function usePointMode({ onPick }: UsePointModeOptions): UsePointModeResult {
  const [armed, setArmed] = useState(false);
  const overlayRef = useRef<PointModeOverlayHandle | null>(null);
  const onPickRef = useRef(onPick);

  // Keep the latest `onPick` reachable from the event listeners below
  // without re-subscribing them on every render (they only depend on
  // `armed`). Writing a ref belongs in an effect, not render — this repo's
  // eslint-config-next React Compiler rules (`react-hooks/refs`) reject a
  // bare `onPickRef.current = onPick` at the top of the component body.
  useEffect(() => {
    onPickRef.current = onPick;
  });

  const toggle = useCallback(() => setArmed((a) => !a), []);
  const disarm = useCallback(() => setArmed(false), []);

  useEffect(() => {
    if (!armed) return;

    // `overlayRef.current` (the imperative handle) is stable for the
    // whole time `armed` stays true — captured once here so the cleanup
    // below reads this snapshot instead of re-touching the ref directly
    // (`react-hooks/exhaustive-deps`'s guidance for ref reads in cleanup).
    const overlay = overlayRef.current;

    document.documentElement.style.cursor = "crosshair";

    let rafId: number | null = null;
    let hoverEl: Element | null = null;
    let touchHandled = false;
    let flashTimer: number | null = null;

    function flushHover() {
      rafId = null;
      if (!hoverEl) {
        overlay?.hide();
        return;
      }
      overlay?.show(hoverEl.getBoundingClientRect(), labelFor(hoverEl));
    }

    function onPointerMove(ev: PointerEvent) {
      hoverEl = surveySurfaceAt(ev.target);
      if (rafId == null) rafId = requestAnimationFrame(flushHover);
    }

    function onPointerUp(ev: PointerEvent) {
      if (ev.pointerType !== "touch") return; // mouse/pen picks resolve on `click` below
      if (isInsideBay(ev.target)) return; // let the bay's own buttons handle their own tap
      const el = surveySurfaceAt(ev.target);
      if (!el) {
        setArmed(false); // tap on paper — disarm silently, no flash
        return;
      }
      touchHandled = true;
      const id = el.getAttribute("data-survey") ?? "";
      const label = labelFor(el);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        overlay?.hide();
        onPickRef.current(id, label);
        setArmed(false);
        return;
      }
      overlay?.flash(el.getBoundingClientRect(), label);
      flashTimer = window.setTimeout(() => {
        overlay?.hide();
        onPickRef.current(id, label);
        setArmed(false);
      }, FLASH_MS);
    }

    function onClick(ev: MouseEvent) {
      if (isInsideBay(ev.target)) return; // POINT/LOG/CLEAR LOG keep working while armed
      ev.preventDefault();
      ev.stopPropagation();
      if (touchHandled) {
        touchHandled = false; // this gesture's pick was already resolved by onPointerUp
        return;
      }
      const el = surveySurfaceAt(ev.target);
      setArmed(false);
      if (el) onPickRef.current(el.getAttribute("data-survey") ?? "", labelFor(el));
    }

    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("click", onClick, true);
      if (rafId != null) cancelAnimationFrame(rafId);
      if (flashTimer != null) window.clearTimeout(flashTimer);
      document.documentElement.style.cursor = "";
      overlay?.hide();
    };
  }, [armed]);

  return { armed, toggle, disarm, overlayRef };
}
