/**
 * app/photos/[roll]/[id]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a single photo entry at /photos/<roll>/<id>.
 *
 * Route: [roll] × [id] = two dynamic segments.
 * params is a Promise in this Next.js version — must be awaited.
 *
 * Static generation: generateStaticParams() returns all (roll, id) pairs
 * from the velite photoSidecars cache so every known sidecar is pre-rendered
 * at build time.
 *
 * 404: notFound() when the (roll, id) pair does not resolve in the cache.
 *
 * Reuses production chrome: PageShell, Nav, MarginaliaHUD, ScrollMeter,
 * CornerMarks — same as homepage. No re-derivation of atoms.
 *
 * Owner: Sirius (α-SUR-01) · TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PageShell } from "@/components/PageShell";
import { Nav } from "@/components/Nav";
import { MarginaliaHUD, ScrollMeter } from "@/components/MarginaliaHUD";
import { CornerMarks } from "@/components/CornerMarks";
import { PhotoEntry } from "@/components/PhotoEntry";
import { WorldlineLinks } from "@/components/WorldlineLinks";

import {
  getPhotoSidecars,
  getPhotoByRollAndId,
  getSidecarsInRoll,
} from "@/lib/content/photos";

// ─────────────────────────────────────────────────────────────────────────────
// Static generation — pre-render all known (roll, id) pairs at build time.
// generateStaticParams docs: node_modules/next/dist/docs/01-app/03-api-reference/
//   04-functions/generate-static-params.md
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const sidecars = await getPhotoSidecars();
  return sidecars.map((s) => ({ roll: s.roll, id: s.id }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-photo metadata
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ roll: string; id: string }>;
}): Promise<Metadata> {
  // params is a Promise in this Next.js version — await before destructuring.
  const { roll, id } = await params;
  const photo = await getPhotoByRollAndId(roll, id);

  if (!photo) {
    return { title: "Photo Not Found · Worldline" };
  }

  const titleParts = [id, roll, "Worldline · ∇ Neospirit"];
  return {
    title: titleParts.join(" · "),
    description: photo.caption ?? `Photo ${id} from roll ${roll}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────
export default async function PhotoEntryPage({
  params,
}: {
  params: Promise<{ roll: string; id: string }>;
}) {
  // params is a Promise in this Next.js version — await before destructuring.
  const { roll, id } = await params;

  const photo = await getPhotoByRollAndId(roll, id);

  // 404 when (roll, id) does not resolve.
  if (!photo) {
    notFound();
  }

  // Roll context: sequence index + total for the left-aside readout.
  const rollPhotos = await getSidecarsInRoll(roll);
  const sequenceIndex = rollPhotos.findIndex((s) => s.id === id);
  const rollTotal = rollPhotos.length;

  return (
    <PageShell>
      {/*
       * Production chrome reuse (SHIP-PLAN §5): PageShell, Nav, MarginaliaHUD,
       * ScrollMeter, CornerMarks — same as homepage, no re-derivation.
       * paper-canvas grain, pr-7 for marginalia gutter — matches homepage.
       */}
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />

        <Nav />

        {/* Skip link — keyboard a11y */}
        <a
          href="#photo-main"
          style={{
            position: "absolute",
            left: "-9999px",
            zIndex: 100,
            padding: "4px 8px",
            background: "var(--paper-warm)",
            color: "var(--ink-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
          }}
          className="focus:left-2 focus:top-2"
        >
          Skip to photo
        </a>

        {/* PhotoEntry surface — the D3 three-column grid */}
        <div
          data-section="photo-entry"
          style={{ marginTop: "14px", position: "relative" }}
        >
          <PhotoEntry
            photo={photo}
            sequenceIndex={sequenceIndex >= 0 ? sequenceIndex : 0}
            rollTotal={rollTotal > 0 ? rollTotal : 1}
          />

          {/*
           * § worldline section — L2b local-view (S3 worldline-schema + this ship).
           * Rendered below the photo entry surface. Absent when no links exist.
           * identifier format for photos: "roll/id" — matches the canonical corpus key
           * format "photos/<roll>/<id>" minus the "photos/" prefix (see worldline.ts).
           * title: photo caption as display title (or id when no caption).
           */}
          <WorldlineLinks
            kind="photo"
            identifier={`${roll}/${id}`}
            title={photo.caption ?? id}
          />
        </div>
      </main>
    </PageShell>
  );
}
