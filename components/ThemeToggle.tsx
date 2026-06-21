"use client";

import { useThemeMode, setThemeMode } from "@/lib/useThemeMode";

/**
 * REGISTER — the desktop theme control (fixed bottom-right), ported from the
 * Worldline Dark Mode PoC. Two buttons: ○ DAY / ◆ NIGHT, the active one carries
 * an orange underline. Hidden ≤600px (.register { display:none }) — on phone the
 * toggle folds into the nav-slim action cluster (see Nav.tsx .nav-slim-theme).
 *
 * Both presentations share one source of truth via setThemeMode / useThemeMode,
 * so they always reflect the same register.
 */
export function ThemeToggle() {
  const mode = useThemeMode();

  return (
    <div className="register" role="radiogroup" aria-label="display register" suppressHydrationWarning>
      <span className="rlab">REGISTER</span>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "light"}
        className={mode === "light" ? "is-active" : undefined}
        onClick={() => setThemeMode("light")}
      >
        <span className="gl" aria-hidden="true">○</span> DAY
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "dark"}
        className={mode === "dark" ? "is-active" : undefined}
        onClick={() => setThemeMode("dark")}
      >
        <span className="gl" aria-hidden="true">◆</span> NIGHT
      </button>
    </div>
  );
}
