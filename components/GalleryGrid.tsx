"use client";

/**
 * GalleryGrid.tsx — client component
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the interactive photo grid for /photos (gallery index).
 * Receives all published photos (pre-grouped by roll) from the server page.
 * Handles cell hover state, lightbox open/close/navigate, and mobile guard.
 *
 * Design reference: docs/design/SPEC-2026-06-14-photo-gallery.md
 * Extended by: docs/design/SPEC-2026-06-14-photo-feedback.md §#2 view modes
 *
 * Key spec decisions implemented here:
 *   - Grid: auto-fill minmax(220px, 1fr), gap 24px. Self-adjusting columns.
 *   - Roll sections: <section> per roll, dashed hairline below header.
 *   - Paper-mount cells: 12px --paper-warm margin + 1px --ink-faint border.
 *   - Hover on cell (has image): inset 0 0 0 1px --ink-faint (120ms ease);
 *     caption opacity 0→1 (150ms ease).
 *   - focus-visible: 2px solid accent-orange, offset 2px (via GalleryGrid.css).
 *   - Placeholder cells: data-no-image; click navigates to entry (no lightbox).
 *   - Mobile (<600px): lightbox disabled; cell click navigates to entry.
 *   - Lightbox navigation: ← / → keys within same roll group.
 *
 * View modes (?view= URL param, spec #2):
 *   - timeline (default) — roll groupings, newest roll first (existing behavior)
 *   - flat              — single continuous grid, newest photo first; roll label
 *                         shown as second line in mount label.
 *   - place             — grouped by authoredCoords.place or place_id name;
 *                         UNLOCATED catch-all group at end. Section headers share
 *                         the same rhythm as TIMELINE roll headers.
 *
 * The view toggle (.gv-modes) is rendered inside this client island so the
 * URL navigation (router.push) lives with the active state. Toggle is hidden
 * at ≤600px via CSS (.gv-modes { display:none } at ≤600px).
 *
 * Page header (PHOTOGRAPHS + frame/roll count + toggle) is rendered inside
 * this component (client island) rather than the server page, so the toggle
 * and count text are co-located with the mode state.
 *
 * Atoms composed: paper-mount (GalleryGrid.css), section-rule-dashed (globals.css).
 *
 * Modeled after: RollIndex.tsx (paper-mount atom + RollIndex.css side-effect import).
 *
 * Owner: Sirius (α-SUR-01) · gallery-view slice
 */

// Side-effect import: gallery-scoped paper-mount atom rules + responsive layout.
// NOT a CSS module — media-query overrides require no class mangling.
import "./GalleryGrid.css";

import { useState, useCallback, useId, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { GalleryLightbox, type LightboxPhoto } from "./GalleryLightbox";
import type { PhotoSidecar } from "@/lib/content/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GalleryView = "timeline" | "flat" | "place";

export interface GalleryRollGroup {
  roll: string;
  photos: LightboxPhoto[];
}

interface GalleryGridProps {
  /** Photos grouped by roll, newest-roll-first (server sorts). */
  rollGroups: GalleryRollGroup[];
  /** Initial view mode from URL ?view= param (server-determined). */
  initialView?: GalleryView;
  /**
   * Raw sidecars for flat + place mode computation.
   * These carry isoDate and place metadata not in LightboxPhoto.
   */
  sidecars?: PhotoSidecar[];
  /** Total frame count (passed from server for the page header). */
  totalFrames?: number;
  /** Total roll count (passed from server for the page header). */
  totalRolls?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW_MODES — canonical segment definitions
// ─────────────────────────────────────────────────────────────────────────────

const VIEW_MODES: { id: GalleryView; label: string }[] = [
  { id: "timeline", label: "TIMELINE" },
  { id: "flat",     label: "FLAT" },
  { id: "place",    label: "PLACE" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper — resolve a place label from a sidecar.
// Priority: place_id resolved name from authoredCoords.place or sidecar.placeId
// (placeId is the raw FK string; we don't have the resolved name here, so we
// fall back to authoredCoords.place — the string label authored in the entry).
// When both are absent → UNLOCATED.
// ─────────────────────────────────────────────────────────────────────────────

function resolvePlaceLabel(sidecar: PhotoSidecar): string {
  // authoredCoords.place is the canonical string label (from the entry's coords JSON)
  if (sidecar.authoredCoords?.place) return sidecar.authoredCoords.place.toUpperCase();
  // placeId present but no place string — mark as located but label unknown
  // (edge case: placeId set but authoredCoords not populated yet; treat as UNLOCATED
  // in gallery view since we don't have the resolved name in the sidecar payload)
  return "UNLOCATED";
}


// ─────────────────────────────────────────────────────────────────────────────
// GalleryGrid
// ─────────────────────────────────────────────────────────────────────────────

export function GalleryGrid({
  rollGroups,
  initialView = "timeline",
  sidecars = [],
  totalFrames,
  totalRolls,
}: GalleryGridProps) {
  const [view, setView] = useState<GalleryView>(initialView);
  const [lightboxPhoto, setLightboxPhoto] = useState<LightboxPhoto | null>(null);
  const [lightboxRollPhotos, setLightboxRollPhotos] = useState<LightboxPhoto[]>([]);
  const [originCellId, setOriginCellId] = useState<string | undefined>(undefined);
  const [hoverCellId, setHoverCellId] = useState<string | null>(null);

  // Roving tabindex for the view toggle group
  const toggleRef = useRef<HTMLDivElement>(null);

  const uid = useId();
  const router = useRouter();

  // ── Open lightbox ────────────────────────────────────────────────────────
  const openLightbox = useCallback(
    (photo: LightboxPhoto, rollPhotos: LightboxPhoto[], cellId: string) => {
      setLightboxPhoto(photo);
      setLightboxRollPhotos(rollPhotos);
      setOriginCellId(cellId);
    },
    []
  );

  const closeLightbox = useCallback(() => {
    setLightboxPhoto(null);
    setLightboxRollPhotos([]);
  }, []);

  const navigateLightbox = useCallback((photo: LightboxPhoto) => {
    setLightboxPhoto(photo);
  }, []);

  // ── View switch — push URL param, update local state ────────────────────
  const switchView = useCallback((v: GalleryView) => {
    setView(v);
    // Reset scroll to top of grid on view switch (spec §scroll/transition)
    const grid = document.getElementById("gallery-grid");
    if (grid) grid.scrollIntoView({ behavior: "instant", block: "start" });
    const url = new URL(window.location.href);
    if (v === "timeline") {
      url.searchParams.delete("view");
    } else {
      url.searchParams.set("view", v);
    }
    router.push(url.pathname + (url.search || ""), { scroll: false });
  }, [router]);

  // ── Keyboard roving tabindex for toggle group ────────────────────────────
  // ← / → arrows cycle segments; Enter/Space activates.
  const onToggleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const buttons = Array.from(
        toggleRef.current?.querySelectorAll<HTMLButtonElement>(".gv-mode") ?? []
      );
      if (buttons.length === 0) return;
      const cur = buttons.findIndex((b) => document.activeElement === b);
      let next = cur;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next = (cur + 1) % buttons.length;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        next = (cur - 1 + buttons.length) % buttons.length;
      } else {
        return;
      }
      buttons[next].focus();
    },
    []
  );

  // ── Flat mode: all photos newest-first ───────────────────────────────────
  const flatPhotos = useMemo<Array<{ photo: LightboxPhoto; roll: string }>>(() => {
    // Sort sidecars newest-first (by isoDate descending)
    const sorted = [...sidecars].sort((a, b) =>
      (b.isoDate ?? "").localeCompare(a.isoDate ?? "")
    );
    return sorted.map((s) => ({
      roll: s.roll,
      photo: {
        roll: s.roll,
        id: s.id,
        caption: s.caption,
        date: s.isoDate.replace(/-/g, "."),
        variants: s.variants,
      },
    }));
  }, [sidecars]);

  // ── Place mode: grouped by place label, UNLOCATED last ───────────────────
  const placeGroups = useMemo<Array<{ place: string; photos: Array<{ photo: LightboxPhoto; roll: string }> }>>(() => {
    // Build a map: place label → photos
    const map = new Map<string, Array<{ photo: LightboxPhoto; roll: string; isoDate: string }>>();
    for (const s of sidecars) {
      const label = resolvePlaceLabel(s);
      const existing = map.get(label);
      const entry = {
        roll: s.roll,
        isoDate: s.isoDate ?? "",
        photo: {
          roll: s.roll,
          id: s.id,
          caption: s.caption,
          date: s.isoDate.replace(/-/g, "."),
          variants: s.variants,
        },
      };
      if (existing) {
        existing.push(entry);
      } else {
        map.set(label, [entry]);
      }
    }

    // Sort each group newest-first
    for (const group of map.values()) {
      group.sort((a, b) => b.isoDate.localeCompare(a.isoDate));
    }

    // Sort place groups alphabetically; UNLOCATED always last
    const groups = Array.from(map.entries())
      .filter(([place]) => place !== "UNLOCATED")
      .sort(([a], [b]) => a.localeCompare(b));

    const unlocated = map.get("UNLOCATED");
    if (unlocated) groups.push(["UNLOCATED", unlocated]);

    return groups.map(([place, entries]) => ({
      place,
      photos: entries.map(({ photo, roll }) => ({ photo, roll })),
    }));
  }, [sidecars]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const displayTotalFrames = totalFrames ?? sidecars.length;
  const displayTotalRolls = totalRolls ?? rollGroups.length;

  // ── Live region announcement text ────────────────────────────────────────
  const modeLabel =
    view === "flat" ? "FLAT GRID" : view === "place" ? "BY PLACE" : "TIMELINE";
  const liveAnnounce = `${displayTotalFrames} FRAME${displayTotalFrames !== 1 ? "S" : ""} IN ${modeLabel} VIEW`;

  return (
    <>
      {/* ── Page header with view toggle ── */}
      <header
        style={{
          paddingTop: "16px",
          paddingBottom: "12px",
          marginBottom: "32px",
          borderBottom: "1px dashed var(--ink-dashed)",
        }}
      >
        {/*
         * ≥881px: one row — PHOTOGRAPHS left, toggle right.
         * ≤880px: PHOTOGRAPHS + count on top row, toggle on second row.
         * ≤600px: toggle hidden (timeline only).
         * Implemented via flex-wrap + toggle on a new line via the CSS class.
         * The spec illustration uses a CSS grid at ≥881px, but flex-wrap achieves
         * the same layout with fewer breakpoint rules. Both approaches satisfy spec.
         */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "12px",
          }}
        >
          {/* Left cluster: PHOTOGRAPHS heading + count */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--meta-size)",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                fontWeight: 400,
                color: "var(--ink-soft)",
              }}
            >
              PHOTOGRAPHS
            </h1>
            <span
              aria-label={`${displayTotalFrames} frames across ${displayTotalRolls} rolls`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--meta-size)",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "var(--ink-soft)",
                whiteSpace: "nowrap",
              }}
            >
              {String(displayTotalFrames).padStart(2, "0")} FRAME{displayTotalFrames !== 1 ? "S" : ""} ·{" "}
              {String(displayTotalRolls).padStart(2, "0")} ROLL{displayTotalRolls !== 1 ? "S" : ""}
            </span>
          </div>

          {/* Right: view toggle — hidden at ≤600px via CSS .gv-modes { display:none } */}
          <div
            ref={toggleRef}
            className="gv-modes"
            role="group"
            aria-label="Gallery view"
            onKeyDown={onToggleKeyDown}
          >
            {VIEW_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={"gv-mode" + (view === m.id ? " is-on" : "")}
                aria-pressed={view === m.id}
                tabIndex={view === m.id ? 0 : -1}
                onClick={() => switchView(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Gallery grid ── */}
      <div
        id="gallery-grid"
        role="region"
        aria-label="Photo gallery"
      >
        {/* Live announce region — announces mode/count change to screen readers */}
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute",
            width: "1px",
            height: "1px",
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
          }}
        >
          {liveAnnounce}
        </div>

        {/* ── TIMELINE view (default) ── */}
        {view === "timeline" && (
          <>
            {rollGroups.length === 0 ? (
              <div
                style={{
                  padding: "48px 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--meta-size)",
                  letterSpacing: "var(--meta-tracking)",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                }}
              >
                NO FRAMES DOCUMENTED
              </div>
            ) : (
              rollGroups.map((group, groupIdx) => {
                const { roll, photos } = group;
                const frameCount = photos.length;
                const slugDisplay = roll.toUpperCase();
                const isFirstGroup = groupIdx === 0;

                return (
                  <section
                    key={roll}
                    aria-label={`Roll ${roll}`}
                    style={{
                      paddingTop: isFirstGroup ? 0 : "36px",
                    }}
                  >
                    {/* Roll section header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "12px",
                        paddingBottom: "10px",
                        marginBottom: "20px",
                        borderBottom: "1px dashed var(--ink-dashed)",
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--meta-size)",
                          letterSpacing: "0.22em",
                          textTransform: "uppercase",
                          fontWeight: 400,
                          color: "var(--ink-faint)",
                          display: "flex",
                          gap: "6px",
                          alignItems: "baseline",
                        }}
                      >
                        <span>ROLL ·</span>
                        {/*
                         * CW-12 · roll header touch target (ux-journey, α-SUR-01, 2026-06-14)
                         * Was 14px tall — the primary drill-down on /photos, un-tappable on mobile.
                         * display:flex + minHeight:44px brings tap zone to 44px. Visual unchanged.
                         */}
                        <a
                          href={`/photos/${roll}`}
                          style={{
                            color: "var(--ink-soft)",
                            textDecoration: "none",
                            letterSpacing: "0.22em",
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--meta-size)",
                            display: "flex",
                            alignItems: "center",
                            minHeight: "44px",
                          }}
                          aria-label={`View roll ${roll}`}
                        >
                          {slugDisplay}
                        </a>
                      </h2>
                      <span
                        aria-hidden
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--meta-size)",
                          letterSpacing: "0.22em",
                          textTransform: "uppercase",
                          color: "var(--ink-faint)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {String(frameCount).padStart(2, "0")} FRAME{frameCount !== 1 ? "S" : ""}
                      </span>
                    </div>

                    {frameCount === 0 ? (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--meta-size)",
                          letterSpacing: "0.22em",
                          textTransform: "uppercase",
                          color: "var(--ink-faint)",
                          paddingBottom: "24px",
                        }}
                      >
                        NO FRAMES
                      </div>
                    ) : (
                      <ul
                        style={{
                          listStyle: "none",
                          margin: 0,
                          padding: 0,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                          gap: "24px",
                        }}
                      >
                        {photos.map((photo) => {
                          const hasImage = !!(photo.variants?.medium?.webp);
                          const cellId = `gallery-cell-${uid}-${roll}-${photo.id}`;
                          const isHovered = hoverCellId === cellId;
                          const ariaLabel = photo.caption
                            ? `Photo ${photo.id} from roll ${roll} · ${photo.caption}`
                            : `Photo ${photo.id} from roll ${roll}`;

                          return (
                            <li key={photo.id}>
                              <a
                                id={cellId}
                                href={`/photos/${roll}/${photo.id}`}
                                className="gallery-cell"
                                aria-label={ariaLabel}
                                title={photo.id}
                                data-no-image={!hasImage ? "true" : undefined}
                                onClick={(e) => {
                                  if (!hasImage) return;
                                  if (typeof window !== "undefined" && window.innerWidth < 600) return;
                                  e.preventDefault();
                                  openLightbox(photo, photos, cellId);
                                }}
                                onMouseEnter={() => setHoverCellId(cellId)}
                                onMouseLeave={() => setHoverCellId(null)}
                                style={{ display: "block", textDecoration: "none", color: "inherit" }}
                              >
                                <div
                                  className="paper-mount"
                                  style={{
                                    boxShadow: isHovered ? "inset 0 0 0 1px var(--ink-faint)" : "none",
                                  }}
                                >
                                  {hasImage ? (
                                    <img
                                      src={photo.variants!.medium.webp}
                                      srcSet={[
                                        photo.variants!.thumb.webp  + " 320w",
                                        photo.variants!.medium.webp + " 1280w",
                                      ].join(", ")}
                                      sizes="(max-width: 375px) 100vw, (max-width: 600px) 50vw, (max-width: 880px) 33vw, 25vw"
                                      alt={photo.caption ?? `Photo ${photo.id} from roll ${roll}`}
                                      className="paper-mount-image"
                                      style={{
                                        width: "100%",
                                        aspectRatio: "3 / 2",
                                        objectFit: "cover",
                                        display: "block",
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="paper-mount-image"
                                      role="img"
                                      aria-label={`No image available — Photo ${photo.id} from roll ${roll}`}
                                      style={{
                                        width: "100%",
                                        aspectRatio: "3 / 2",
                                        background: "var(--paper-deep)",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        gap: "6px",
                                      }}
                                    >
                                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--meta-size)", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                                        {photo.id}
                                      </span>
                                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                                        AWAITING IMAGE
                                      </span>
                                    </div>
                                  )}
                                  <div aria-hidden className="paper-mount-label">
                                    {photo.id}
                                  </div>
                                  {photo.caption && (
                                    <div
                                      aria-hidden
                                      // gv-cap: Betelgeuse adds opacity:1 at ≤600px in GalleryGrid.css
                                      // so captions are always visible on tap-less mobile.
                                      className="gv-cap"
                                      style={{
                                        fontFamily: "var(--font-display)",
                                        fontStyle: "italic",
                                        fontSize: "12px",
                                        color: "var(--ink-soft)",
                                        lineHeight: 1.5,
                                        marginTop: "4px",
                                        overflow: "hidden",
                                        display: "-webkit-box",
                                        WebkitBoxOrient: "vertical",
                                        WebkitLineClamp: 1,
                                        opacity: isHovered ? 1 : 0,
                                        transition: "opacity 150ms ease",
                                      }}
                                    >
                                      {photo.caption}
                                    </div>
                                  )}
                                </div>
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                );
              })
            )}
          </>
        )}

        {/* ── FLAT view — all photos newest-first, roll label in cell ── */}
        {view === "flat" && (
          <>
            {flatPhotos.length === 0 ? (
              <div
                style={{
                  padding: "48px 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--meta-size)",
                  letterSpacing: "var(--meta-tracking)",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                }}
              >
                NO FRAMES DOCUMENTED
              </div>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "24px",
                }}
              >
                {flatPhotos.map(({ photo, roll }) => {
                  const hasImage = !!(photo.variants?.medium?.webp);
                  const cellId = `gallery-cell-${uid}-flat-${roll}-${photo.id}`;
                  const isHovered = hoverCellId === cellId;
                  const ariaLabel = photo.caption
                    ? `Photo ${photo.id} from roll ${roll} · ${photo.caption}`
                    : `Photo ${photo.id} from roll ${roll}`;
                  // All photos in a roll group for lightbox nav — find from rollGroups
                  const rollGroup = rollGroups.find((g) => g.roll === roll);
                  const rollPhotos = rollGroup?.photos ?? [photo];

                  return (
                    <li key={`flat-${roll}-${photo.id}`}>
                      <a
                        id={cellId}
                        href={`/photos/${roll}/${photo.id}`}
                        className="gallery-cell"
                        aria-label={ariaLabel}
                        title={photo.id}
                        data-no-image={!hasImage ? "true" : undefined}
                        onClick={(e) => {
                          if (!hasImage) return;
                          if (typeof window !== "undefined" && window.innerWidth < 600) return;
                          e.preventDefault();
                          openLightbox(photo, rollPhotos, cellId);
                        }}
                        onMouseEnter={() => setHoverCellId(cellId)}
                        onMouseLeave={() => setHoverCellId(null)}
                        style={{ display: "block", textDecoration: "none", color: "inherit" }}
                      >
                        <div
                          className="paper-mount"
                          style={{
                            boxShadow: isHovered ? "inset 0 0 0 1px var(--ink-faint)" : "none",
                          }}
                        >
                          {hasImage ? (
                            <img
                              src={photo.variants!.medium.webp}
                              srcSet={[
                                photo.variants!.thumb.webp  + " 320w",
                                photo.variants!.medium.webp + " 1280w",
                              ].join(", ")}
                              sizes="(max-width: 375px) 100vw, (max-width: 600px) 50vw, (max-width: 880px) 33vw, 25vw"
                              alt={photo.caption ?? `Photo ${photo.id} from roll ${roll}`}
                              className="paper-mount-image"
                              style={{
                                width: "100%",
                                aspectRatio: "3 / 2",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : (
                            <div
                              className="paper-mount-image"
                              role="img"
                              aria-label={`No image available — Photo ${photo.id} from roll ${roll}`}
                              style={{
                                width: "100%",
                                aspectRatio: "3 / 2",
                                background: "var(--paper-deep)",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "6px",
                              }}
                            >
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--meta-size)", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                                {photo.id}
                              </span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                                AWAITING IMAGE
                              </span>
                            </div>
                          )}

                          {/* Two-line mount label: frame ID + roll label (spec §FLAT) */}
                          <div aria-hidden className="paper-mount-label">
                            <div className="paper-mount-label-flat paper-mount-label-flat-id">
                              {photo.id}
                            </div>
                            <div className="paper-mount-label-flat paper-mount-label-flat-roll">
                              {`ROLL · ${roll.toUpperCase()}`}
                            </div>
                          </div>

                          {photo.caption && (
                            <div
                              aria-hidden
                              // gv-cap: Betelgeuse adds opacity:1 at ≤600px in GalleryGrid.css
                              // so captions are always visible on tap-less mobile.
                              className="gv-cap"
                              style={{
                                fontFamily: "var(--font-display)",
                                fontStyle: "italic",
                                fontSize: "12px",
                                color: "var(--ink-soft)",
                                lineHeight: 1.5,
                                marginTop: "4px",
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 1,
                                opacity: isHovered ? 1 : 0,
                                transition: "opacity 150ms ease",
                              }}
                            >
                              {photo.caption}
                            </div>
                          )}
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {/* ── BY PLACE view ── */}
        {view === "place" && (
          <>
            {placeGroups.length === 0 ? (
              <div
                style={{
                  padding: "48px 0",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--meta-size)",
                  letterSpacing: "var(--meta-tracking)",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                }}
              >
                NO FRAMES DOCUMENTED
              </div>
            ) : (
              placeGroups.map((group, groupIdx) => {
                const { place, photos } = group;
                const isFirst = groupIdx === 0;

                return (
                  <section key={place} aria-label={`Place: ${place}`}>
                    {/* Section header: PLACE · {name} left, count right */}
                    <div
                      style={{
                        paddingTop: isFirst ? 0 : "36px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: "12px",
                          paddingBottom: "10px",
                          marginBottom: "20px",
                          borderBottom: "1px dashed var(--ink-dashed)",
                        }}
                      >
                        <h2
                          style={{
                            margin: 0,
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--meta-size)",
                            letterSpacing: "0.22em",
                            textTransform: "uppercase",
                            fontWeight: 400,
                            color: "var(--ink-faint)",
                            display: "flex",
                            gap: "6px",
                            alignItems: "baseline",
                          }}
                        >
                          {place === "UNLOCATED" ? (
                            <span style={{ color: "var(--ink-soft)" }}>UNLOCATED</span>
                          ) : (
                            <>
                              <span>PLACE ·</span>
                              <span style={{ color: "var(--ink-soft)" }}>{place}</span>
                            </>
                          )}
                        </h2>
                        <span
                          aria-hidden
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--meta-size)",
                            letterSpacing: "0.22em",
                            textTransform: "uppercase",
                            color: "var(--ink-faint)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {String(photos.length).padStart(2, "0")} FRAME{photos.length !== 1 ? "S" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Photo grid — all photos in this place group */}
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                        gap: "24px",
                      }}
                    >
                      {photos.map(({ photo, roll }) => {
                        const hasImage = !!(photo.variants?.medium?.webp);
                        const cellId = `gallery-cell-${uid}-place-${place}-${roll}-${photo.id}`;
                        const isHovered = hoverCellId === cellId;
                        const ariaLabel = photo.caption
                          ? `Photo ${photo.id} from roll ${roll} · ${photo.caption}`
                          : `Photo ${photo.id} from roll ${roll}`;
                        const rollGroup = rollGroups.find((g) => g.roll === roll);
                        const rollPhotos = rollGroup?.photos ?? [photo];

                        return (
                          <li key={`place-${place}-${roll}-${photo.id}`}>
                            <a
                              id={cellId}
                              href={`/photos/${roll}/${photo.id}`}
                              className="gallery-cell"
                              aria-label={ariaLabel}
                              title={photo.id}
                              data-no-image={!hasImage ? "true" : undefined}
                              onClick={(e) => {
                                if (!hasImage) return;
                                if (typeof window !== "undefined" && window.innerWidth < 600) return;
                                e.preventDefault();
                                openLightbox(photo, rollPhotos, cellId);
                              }}
                              onMouseEnter={() => setHoverCellId(cellId)}
                              onMouseLeave={() => setHoverCellId(null)}
                              style={{ display: "block", textDecoration: "none", color: "inherit" }}
                            >
                              <div
                                className="paper-mount"
                                style={{
                                  boxShadow: isHovered ? "inset 0 0 0 1px var(--ink-faint)" : "none",
                                }}
                              >
                                {hasImage ? (
                                  <img
                                    src={photo.variants!.medium.webp}
                                    srcSet={[
                                      photo.variants!.thumb.webp  + " 320w",
                                      photo.variants!.medium.webp + " 1280w",
                                    ].join(", ")}
                                    sizes="(max-width: 375px) 100vw, (max-width: 600px) 50vw, (max-width: 880px) 33vw, 25vw"
                                    alt={photo.caption ?? `Photo ${photo.id} from roll ${roll}`}
                                    className="paper-mount-image"
                                    style={{
                                      width: "100%",
                                      aspectRatio: "3 / 2",
                                      objectFit: "cover",
                                      display: "block",
                                    }}
                                  />
                                ) : (
                                  <div
                                    className="paper-mount-image"
                                    role="img"
                                    aria-label={`No image available — Photo ${photo.id} from roll ${roll}`}
                                    style={{
                                      width: "100%",
                                      aspectRatio: "3 / 2",
                                      background: "var(--paper-deep)",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--meta-size)", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                                      {photo.id}
                                    </span>
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
                                      AWAITING IMAGE
                                    </span>
                                  </div>
                                )}

                                <div aria-hidden className="paper-mount-label">
                                  {photo.id}
                                </div>

                                {photo.caption && (
                                  <div
                                    aria-hidden
                                    // gv-cap: Betelgeuse adds opacity:1 at ≤600px in GalleryGrid.css
                                    // so captions are always visible on tap-less mobile.
                                    className="gv-cap"
                                    style={{
                                      fontFamily: "var(--font-display)",
                                      fontStyle: "italic",
                                      fontSize: "12px",
                                      color: "var(--ink-soft)",
                                      lineHeight: 1.5,
                                      marginTop: "4px",
                                      overflow: "hidden",
                                      display: "-webkit-box",
                                      WebkitBoxOrient: "vertical",
                                      WebkitLineClamp: 1,
                                      opacity: isHovered ? 1 : 0,
                                      transition: "opacity 150ms ease",
                                    }}
                                  >
                                    {photo.caption}
                                  </div>
                                )}
                              </div>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>

      {/* ── Lightbox — portaled to document.body ── */}
      <GalleryLightbox
        photo={lightboxPhoto}
        rollPhotos={lightboxRollPhotos}
        onClose={closeLightbox}
        onNavigate={navigateLightbox}
        originCellId={originCellId}
      />
    </>
  );
}
