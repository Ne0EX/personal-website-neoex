"use client";

import { useSyncExternalStore } from "react";

/**
 * Worldline theme mode — opt-in dark ("night register").
 *
 * The theme is a single source of truth on <html data-theme>: absent / "light"
 * = the default paper register, "dark" = the night register (token swap in
 * app/globals.css under [data-theme="dark"]). There is intentionally NO React
 * context / provider — state lives on the DOM attribute, persistence lives in
 * localStorage, and subscribers re-read via a MutationObserver. This keeps the
 * server layout untouched and lets any client island (the REGISTER toggle, the
 * nav-slim button, the Three.js globes) stay in sync without prop-drilling.
 *
 * The no-FOUC bootstrap in app/layout.tsx sets the attribute before first paint;
 * setThemeMode() is the only writer thereafter.
 */

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "worldline-theme";

/** Read the current mode straight off the DOM (SSR-safe: defaults to light). */
export function getThemeMode(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Set the mode: writes the <html data-theme> attribute (which cascades the CSS
 * token swap) and persists the choice. The MutationObserver in useThemeMode()
 * propagates the change to every subscriber, so both toggle presentations and
 * the globes stay consistent.
 */
export function setThemeMode(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  if (mode === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* storage may be unavailable (private mode / blocked) — non-fatal */
  }
}

/** Toggle between light and dark. */
export function toggleThemeMode(): ThemeMode {
  const next: ThemeMode = getThemeMode() === "dark" ? "light" : "dark";
  setThemeMode(next);
  return next;
}

function subscribeTheme(callback: () => void) {
  if (typeof document === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

/**
 * Subscribe to the current theme mode. Returns "light" until mounted (matching
 * SSR), then reflects the live <html data-theme> attribute and updates whenever
 * it changes — from this island or any other.
 */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(
    subscribeTheme,
    getThemeMode,
    () => "light"
  );
}
