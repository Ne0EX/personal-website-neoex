/**
 * app/photos/[roll]/[id]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a single photo entry at /photos/<roll>/<id>.
 *
 * S3 store-as-source: reads from lib/store/reads (anon client).
 * Draft gate: photo.draft===true → notFound().
 * Unknown (roll,id): getPhotoByRollAndId returns null → notFound().
 *
 * Owner: Sirius (α-SUR-01) · TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP / Procyon S3
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
  const { roll, id } = await params;
  const photo = await getPhotoByRollAndId(roll, id);

  if (!photo || photo.draft) {
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
  const { roll, id } = await params;

  const photo = await getPhotoByRollAndId(roll, id);

  // notFound() covers: unknown (roll,id), deleted entry, draft in public.
  if (!photo || photo.draft) {
    notFound();
  }

  const rollPhotos = await getSidecarsInRoll(roll);
  const sequenceIndex = rollPhotos.findIndex((s) => s.id === id);
  const rollTotal = rollPhotos.length;

  return (
    <PageShell>
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <Nav />

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

        <div
          data-section="photo-entry"
          style={{ marginTop: "14px", position: "relative" }}
        >
          <PhotoEntry
            photo={photo}
            sequenceIndex={sequenceIndex >= 0 ? sequenceIndex : 0}
            rollTotal={rollTotal > 0 ? rollTotal : 1}
          />

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
