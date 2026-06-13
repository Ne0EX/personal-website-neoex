/**
 * app/photos/page.tsx — server component
 * ─────────────────────────────────────────────────────────────────────────────
 * The /photos gallery index — a calm responsive grid of paper-mount cells
 * grouped by roll, with a keyboard-driven lightbox for fullscreen viewing.
 *
 * Design reference: docs/design/SPEC-2026-06-14-photo-gallery.md (Betelgeuse)
 * Extends with: docs/design/SPEC-2026-06-14-photo-feedback.md §#2 view modes
 *
 * Layout:
 *   - Page header: PHOTOGRAPHS (left) + view toggle (right, ≥601px)
 *   - Frame count row below heading when toggle is inline
 *   - Dashed hairline below header
 *   - Roll sections: each with a sparse instrument label + dashed hairline
 *   - Grid: auto-fill minmax(220px,1fr), gap 24px — self-adjusting columns
 *   - Sparse instrument page footer: {n} FRAMES DOCUMENTED · WORLDLINE · 1.130426
 *   - CornerMarks: outer container corner reticles (atom corner-reticle)
 *
 * View modes (?view= URL param):
 *   - timeline (default) — roll groupings, newest roll first
 *   - flat              — single continuous grid, newest photo first
 *   - place             — grouped by authoredCoords.place or place_id, UNLOCATED last
 *
 * Data: getPhotoSidecars() — published photos only (RLS-gated).
 * Roll grouping: server-side, newest-roll-first (by latest photo iso_date).
 * Placeholder handling: migrated no-image photos render gracefully via GalleryGrid.
 *
 * Soul consistency (per spec §soul-consistency):
 *   This page shows photographs beautifully. It does not show why Peat took
 *   them, what they mean, or their NETRA mapping. That depth is earned via:
 *   - [⇋ OPEN ENTRY] in the lightbox → per-photo EXIF / NETRA entry
 *   - Roll label link → /photos/<roll> contact-sheet register
 *   - Triangulate Search (/) → captions, date, roll
 *
 * searchParams is a Promise in Next 15/16 App Router — awaited per docs/api-reference/
 * file-conventions/page.md: "searchParams is a Promise; use async/await to access values."
 *
 * Owner: Sirius (α-SUR-01) · gallery-view slice
 */

import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { Nav } from "@/components/Nav";
import { MarginaliaHUD, ScrollMeter } from "@/components/MarginaliaHUD";
import { CornerMarks } from "@/components/CornerMarks";
import { GalleryGrid, type GalleryRollGroup, type GalleryView } from "@/components/GalleryGrid";
import { getPhotoSidecars } from "@/lib/content/photos";
import type { PhotoSidecar } from "@/lib/content/types";

// ─────────────────────────────────────────────────────────────────────────────
// Static metadata
// ─────────────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "Photographs · Worldline · ∇ Neospirit",
  description:
    "A gallery of photographs from the A.T.L.A.S. archive. Browse by roll, then go deeper into any frame.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Server-side data assembly
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Groups a flat list of sidecars by roll, newest-roll-first.
 * "Newest roll" = the roll with the most recent photo iso_date.
 * Within each roll, photos are in the order returned by getPhotoSidecars()
 * (which orders by iso_date descending) — since roll grouping preserves
 * insertion order this gives newest-first within each roll.
 */
function groupByRoll(sidecars: PhotoSidecar[]): GalleryRollGroup[] {
  // Build a map: roll slug → photos in order
  const rollMap = new Map<string, PhotoSidecar[]>();
  for (const sidecar of sidecars) {
    const existing = rollMap.get(sidecar.roll);
    if (existing) {
      existing.push(sidecar);
    } else {
      rollMap.set(sidecar.roll, [sidecar]);
    }
  }

  // Determine newest photo date per roll for sort
  const rollLatestDate = (photos: PhotoSidecar[]) =>
    photos.reduce((max, p) => (p.isoDate > max ? p.isoDate : max), "");

  // Sort rolls newest-first
  const groups: GalleryRollGroup[] = Array.from(rollMap.entries())
    .sort(([, a], [, b]) => rollLatestDate(b).localeCompare(rollLatestDate(a)))
    .map(([roll, photos]) => ({
      roll,
      photos: photos.map((s) => ({
        roll: s.roll,
        id: s.id,
        caption: s.caption,
        // Display date formatted as YYYY.MM.DD per spec §lightbox meta row
        date: s.isoDate.replace(/-/g, "."),
        variants: s.variants,
      })),
    }));

  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

interface PhotosPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PhotosIndexPage({ searchParams }: PhotosPageProps) {
  // Await searchParams (Next 16 App Router — Promise-based per page.md).
  const params = await searchParams
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view
  const view: GalleryView =
    rawView === "flat" ? "flat"
    : rawView === "place" ? "place"
    : "timeline"

  const sidecars = await getPhotoSidecars();

  const rollGroups = groupByRoll(sidecars);
  const totalFrames = sidecars.length;
  const totalRolls = rollGroups.length;

  return (
    <PageShell>
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <Nav />

        {/* Skip to gallery grid — keyboard a11y */}
        <a
          href="#gallery-grid"
          className="wl-skip-link"
        >
          Skip to gallery
        </a>

        {/*
         * Outer container: max-width 1200px, centered.
         * position: relative required for CornerMarks absolute positioning.
         * Padding matches the roll-index outer container pattern.
         */}
        <div
          style={{
            position: "relative",
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 32px 48px",
          }}
        >
          {/* ── Gallery grid (client island) — renders its own page header ──
               GalleryGrid owns the interactive header (toggle + count) so the
               view toggle lives co-located with the mode state. The server
               passes the initial view (from ?view= URL param), roll groups,
               and the raw sidecars (for flat+place modes). */}
          <GalleryGrid
            rollGroups={rollGroups}
            initialView={view}
            sidecars={sidecars}
            totalFrames={totalFrames}
            totalRolls={totalRolls}
          />

          {/* ── Page footer ── */}
          <footer
            aria-label="Gallery summary"
            style={{
              marginTop: "48px",
              paddingTop: "12px",
              borderTop: "1px solid var(--ink-hairline)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--meta-size)",
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <span>
              {String(totalFrames).padStart(2, "0")} FRAME{totalFrames !== 1 ? "S" : ""} DOCUMENTED
            </span>
            <span>WORLDLINE · 1.130426</span>
          </footer>
        </div>
      </main>
    </PageShell>
  );
}
