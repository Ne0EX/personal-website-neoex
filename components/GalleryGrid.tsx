"use client";

/**
 * GalleryGrid.tsx — client component
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the interactive photo grid for /photos (gallery index).
 * Receives all published photos (pre-grouped by roll) from the server page.
 * Handles cell hover state, lightbox open/close/navigate, and mobile guard.
 *
 * Design reference: docs/design/SPEC-2026-06-14-photo-gallery.md
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
 * Atoms composed: paper-mount (GalleryGrid.css), section-rule-dashed (globals.css).
 *
 * Modeled after: RollIndex.tsx (paper-mount atom + RollIndex.css side-effect import).
 *
 * Owner: Sirius (α-SUR-01) · gallery-view slice
 */

// Side-effect import: gallery-scoped paper-mount atom rules + responsive layout.
// NOT a CSS module — media-query overrides require no class mangling.
import "./GalleryGrid.css";

import { useState, useCallback, useId } from "react";
import { GalleryLightbox, type LightboxPhoto } from "./GalleryLightbox";

export interface GalleryRollGroup {
  roll: string;
  photos: LightboxPhoto[];
}

interface GalleryGridProps {
  /** Photos grouped by roll, newest-roll-first (server sorts). */
  rollGroups: GalleryRollGroup[];
}

export function GalleryGrid({ rollGroups }: GalleryGridProps) {
  const [lightboxPhoto, setLightboxPhoto] = useState<LightboxPhoto | null>(null);
  const [lightboxRollPhotos, setLightboxRollPhotos] = useState<LightboxPhoto[]>([]);
  const [originCellId, setOriginCellId] = useState<string | undefined>(undefined);

  // Hovering cell id (for caption fade + inset shadow)
  const [hoverCellId, setHoverCellId] = useState<string | null>(null);

  const uid = useId();

  // ── Open lightbox ────────────────────────────────────────────────────────
  const openLightbox = useCallback(
    (photo: LightboxPhoto, rollPhotos: LightboxPhoto[], cellId: string) => {
      // Mobile guard: <600px → navigate to entry instead (handled at click site)
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

  return (
    <>
      {/* ── Gallery grid per roll section ── */}
      <div id="gallery-grid">
        {rollGroups.length === 0 ? (
          /* Empty gallery state */
          <div
            style={{
              padding: "48px 0",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--meta-size)",
              letterSpacing: "var(--meta-tracking)",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
            aria-live="polite"
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
                {/* ── Roll section header ── */}
                {/*
                 * h2 for screen-reader document outline, even though it renders
                 * at 9px instrument register (spec §accessibility).
                 */}
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
                  {/* Left: ROLL · {slug} — slug in ink-soft (link), label in ink-faint */}
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
                    {/* Slug is a link to /photos/<roll> — roll contact-sheet */}
                    <a
                      href={`/photos/${roll}`}
                      style={{
                        color: "var(--ink-soft)",
                        textDecoration: "none",
                        letterSpacing: "0.22em",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--meta-size)",
                      }}
                      aria-label={`View roll ${roll}`}
                    >
                      {slugDisplay}
                    </a>
                  </h2>

                  {/* Right: {n} FRAME(S) */}
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

                {/* ── Photos grid or empty section state ── */}
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
                  /*
                   * Semantic ul: grid="list" equivalent for screen readers.
                   * auto-fill minmax(220px, 1fr) — self-adjusting per spec §layout.
                   * gap 24px desktop; CSS overrides at ≤880px / ≤600px / ≤375px.
                   */
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

                      // aria-label per spec §accessibility
                      const ariaLabel = photo.caption
                        ? `Photo ${photo.id} from roll ${roll} · ${photo.caption}`
                        : `Photo ${photo.id} from roll ${roll}`;

                      return (
                        <li key={photo.id}>
                          {/*
                           * Gallery cell — <a> with preventDefault to open lightbox.
                           * data-no-image on placeholder cells: lightbox JS skips them.
                           * focus-visible: 2px solid accent-orange via GalleryGrid.css.
                           */}
                          <a
                            id={cellId}
                            href={`/photos/${roll}/${photo.id}`}
                            className="gallery-cell"
                            aria-label={ariaLabel}
                            title={photo.id}
                            data-no-image={!hasImage ? "true" : undefined}
                            onClick={(e) => {
                              // Placeholder cells: navigate to entry directly (no lightbox)
                              if (!hasImage) return;
                              // Mobile guard: <600px → navigate to entry directly
                              if (typeof window !== "undefined" && window.innerWidth < 600) return;
                              // Desktop with real image: open lightbox
                              e.preventDefault();
                              openLightbox(photo, photos, cellId);
                            }}
                            onMouseEnter={() => setHoverCellId(cellId)}
                            onMouseLeave={() => setHoverCellId(null)}
                            style={{
                              display: "block",
                              textDecoration: "none",
                              color: "inherit",
                            }}
                          >
                            {/*
                             * Atom paper-mount: 12px --paper-warm margin + 1px --ink-faint border.
                             * Visual rules defined in GalleryGrid.css (.gallery-cell .paper-mount).
                             * box-shadow (hover state) applied via inline style + CSS transition.
                             */}
                            <div
                              className="paper-mount"
                              style={{
                                // Hover inset shadow: spec §motion "inset 0 0 0 1px var(--ink-faint)"
                                // Transition 120ms ease; reduced-motion collapses via globals.css
                                boxShadow: isHovered
                                  ? "inset 0 0 0 1px var(--ink-faint)"
                                  : "none",
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
                                /* Placeholder cell — paper-deep fill + frame ID centered.
                                   Established placeholder vocabulary from PhotoEntry.tsx / RollIndex.tsx. */
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
                                  <span
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: "var(--meta-size)",
                                      letterSpacing: "0.22em",
                                      textTransform: "uppercase",
                                      color: "var(--ink-faint)",
                                    }}
                                  >
                                    {photo.id}
                                  </span>
                                  <span
                                    style={{
                                      fontFamily: "var(--font-mono)",
                                      fontSize: "8px",
                                      letterSpacing: "0.22em",
                                      textTransform: "uppercase",
                                      color: "var(--ink-faint)",
                                    }}
                                  >
                                    AWAITING IMAGE
                                  </span>
                                </div>
                              )}

                              {/* Mount label: frame ID — t-mono 9px ink-soft (atom paper-mount-label) */}
                              <div
                                aria-hidden
                                className="paper-mount-label"
                              >
                                {photo.id}
                              </div>

                              {/* Caption — always laid out; fades in on hover (spec §motion).
                                  opacity 0→1 150ms ease; reduced-motion collapses via globals.css. */}
                              {photo.caption && (
                                <div
                                  aria-hidden
                                  style={{
                                    fontFamily: "var(--font-display)",
                                    fontStyle: "italic",
                                    fontSize: "12px",
                                    color: "var(--ink-soft)",
                                    lineHeight: 1.5,
                                    marginTop: "4px",
                                    paddingLeft: "0",
                                    paddingRight: "0",
                                    paddingBottom: "4px",
                                    // Always laid out (no reflow per spec §non-goals)
                                    overflow: "hidden",
                                    display: "-webkit-box",
                                    WebkitBoxOrient: "vertical",
                                    WebkitLineClamp: 1,
                                    // Caption fade-in on hover
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
