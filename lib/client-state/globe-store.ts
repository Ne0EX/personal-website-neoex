/**
 * globe-store.ts — client-side observable for Globe stratum state.
 *
 * Deliberately tiny: no new npm dependencies. Uses useSyncExternalStore
 * (built into React 18/19) and a custom DOM event (`wl:stratum-change`)
 * that WorldlineGlobe dispatches whenever the visitor picks a new stratum.
 *
 * Why custom event instead of zustand:
 *   zustand is not yet installed (tech-proposal §2.6 lists it as future).
 *   When zustand lands (Phase B TASK-26 curation map), migrate this module
 *   to a zustand slice and delete the event-listener approach.
 *
 * The store is module-scoped (singleton). Safe in Next.js App Router
 * because it is only consumed via "use client" components.
 *
 * Usage:
 *   import { useStratumKey } from "@/lib/client-state/globe-store";
 *   const stratum = useStratumKey(); // "all" | "nex" | "neon" | "neo"
 */

"use client";

import { useSyncExternalStore } from "react";

export type StratumKey = "all" | "nex" | "neon" | "neo";

/** Custom event name dispatched by WorldlineGlobe on every stratum change. */
export const WL_STRATUM_EVENT = "wl:stratum-change";

/** Detail shape carried on the custom event. */
export interface StratumChangeDetail {
  stratum: StratumKey;
}

// ─── Module-level store ───────────────────────────────────────────────────────

let currentStratum: StratumKey = "all";
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

/**
 * Subscribe to stratum changes. useSyncExternalStore calls this to register
 * a re-render callback. Returns an unsubscribe function.
 */
function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  // Listen to the DOM event emitted by WorldlineGlobe.
  function onStratumChange(e: Event) {
    const detail = (e as CustomEvent<StratumChangeDetail>).detail;
    if (detail?.stratum && detail.stratum !== currentStratum) {
      currentStratum = detail.stratum;
      notifyListeners();
    }
  }

  // Only add the DOM listener once per subscriber (cleaned up below).
  window.addEventListener(WL_STRATUM_EVENT, onStratumChange);

  return () => {
    listeners.delete(callback);
    window.removeEventListener(WL_STRATUM_EVENT, onStratumChange);
  };
}

function getSnapshot(): StratumKey {
  return currentStratum;
}

// Server-side snapshot — Globe is client-only, so stratum is always "all" on
// the server. This prevents hydration mismatches.
function getServerSnapshot(): StratumKey {
  return "all";
}

// ─── Public hook ─────────────────────────────────────────────────────────────

/**
 * Returns the currently active stratum key.
 * Safe to call in any "use client" component. Returns "all" on the server.
 */
export function useStratumKey(): StratumKey {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
