/**
 * lib/globe-palettes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for the Worldline globe colour palette.
 *
 * EXTRACTED from components/WorldlineGlobe.tsx (α-SUR-01 2026-06-22) as part
 * of the standalone <Globe> component extraction (TASK globe-component).
 * IMPORTED BY:
 *   - components/WorldlineGlobe.tsx  (the full ATLAS instrument)
 *   - components/Globe.tsx           (the reusable standalone sphere)
 *
 * Rule 5: compose from atoms — never re-derive. Any palette change must be
 * made here; both consumers pick it up automatically.
 *
 * These values cannot read CSS variables — Three.js materials take hex numbers.
 * LIGHT values are pixel-identical to the pre-dark-mode baseline (TEAL / Re:Boot
 * reference). DARK values are the design-verified night register.
 *
 * To revert the LIGHT palette to INK baseline replace:
 *   ink: 0x1a2832, innerShade: 0xcfc4ad, ambient: (warm cream), key: (warm)
 *   — and update lib/globe-surface.ts SURFACE_PALETTES.light to INK values.
 *
 * Owner: Sirius (α-SUR-01)
 */

import type { ThemeMode } from "@/lib/useThemeMode";

// ─────────────────────────────────────────────────────────────────────────────

export interface GlobePalette {
  /** Line / contour / grid / shell / axis / place-ink color. */
  ink: number;
  /** Arc / branch / pole beacon / accent color (orange). */
  orange: number;
  /** Inner-shade sphere tint. */
  innerShade: number;
  /** NETRA tracker ring / halo / dot. */
  netraTracker: number;
  /** Ambient light color. */
  ambient: number;
  /** Key directional light color. */
  key: number;
  /** Rim directional light color. */
  rim: number;
  /** Article-panel shadow — rgb() components as a string "R,G,B". */
  articleShadowRGB: string;
  /**
   * Multiplier on ON-GLOBE curvation lines ONLY — lat/lon graticule +
   * contour rings.  NOT the orbital NeX field (shells/rays), which keep full
   * opacity. Dark calms the cream lines that read too hot on a deep sphere.
   */
  lineOpacityScale: number;
  /**
   * Multiplier on the ORBITAL NeX field (shells + rays). Dimmed in dark so
   * the bright web stops competing with — and blurring — the globe's
   * silhouette.
   */
  orbitOpacityScale: number;
  /**
   * Edge/rim glow BackSide opacity. Hard rim ring looked tacky — disabled (0)
   * in both modes. Edge now reads from the lighter ocean disc reaching the edge
   * (see innerShade near-zero in dark).
   */
  edgeGlowOpacity: number;
}

export const GLOBE_PALETTES: Record<ThemeMode, GlobePalette> = {
  light: {
    ink:              0x1f5063,
    orange:           0xD4602A,
    innerShade:       0xb4bbc0,
    netraTracker:     0x4d7a92,
    ambient:          0xefe7d6,
    key:              0xfff4dd,
    rim:              0x2a3a48,
    articleShadowRGB: '31,80,99',
    lineOpacityScale: 1,
    orbitOpacityScale: 1,
    edgeGlowOpacity: 0,
  },
  dark: {
    // Night register — deep-ocean instrument colours. Design-verified by Betelgeuse.
    // Surface stops raised in lib/globe-surface.ts so this ambient/key/rim set reads
    // against a visible teal field, not a black void.
    ink:              0xC8D8D4,
    orange:           0xE87840,
    innerShade:       0x1A303A,
    netraTracker:     0x7AB8CC,
    ambient:          0x3A5562,
    key:              0xD0E4E0,
    rim:              0x5A7A8C,
    articleShadowRGB: '36,62,76',
    lineOpacityScale: 0.6,
    orbitOpacityScale: 0.5,
    edgeGlowOpacity: 0,
  },
};
