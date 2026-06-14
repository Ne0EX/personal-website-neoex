/**
 * PhotoEntry.tsx — server component
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the /photos/<roll>/<id> D3 surface: three-column grid
 * [260 · 1fr · 240] with paper-mount center, EXIF readout right,
 * roll context left.
 *
 * Design reference: docs/design/10-photo-entry-d3-ship.md (Betelgeuse spec)
 * Prototype:        .claude/visual-diffs/TASK-2026-05-26-PHOTO-PROTOTYPE-FIRST/
 *                   directions/direction-3/index.html
 *
 * Atoms composed (per Betelgeuse § atoms used):
 *   paper-mount       — 12px --paper-warm + 1px --ink-faint frame
 *   netra-voice-strip — NETRA L1 bay, always-on solid border
 *   dashed-hairline   — section seams (section-rule-dashed)
 *   type-roles        — Cormorant italic / mono uppercase / Special Elite
 *   corner-reticle    — via existing production layout (CornerMarks)
 *   hud-corner-readout — via existing MarginaliaHUD
 *
 * Side-effect import: PhotoEntry.palette.css loads the 4 film-sim palette
 * blocks. NOT a CSS module — class mangling would defeat the global
 * [data-palette] selector. The compound selectors in that file target this
 * component's root element directly.
 *
 * D2 resolved: NETRA voice text span carries data-netra-voice-text and
 *   data-netra-base-locus (the base locus string). FilmSimSwitcher.tsx reads
 *   these via document.querySelector('[data-netra-voice-text]').
 *
 * D3 resolved: "← back to roll" links to /photos/<roll>.
 *   Route does not exist yet (OUT-of-scope for this ship); 404 is acceptable.
 *
 * Owner: Sirius (α-SUR-01) · TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP
 */

// Side-effect import: loads palette CSS into the global cascade.
// NOT a CSS module — global [data-palette] selectors require no mangling.
import "./PhotoEntry.palette.css";

import Link from "next/link";
import { FilmSimSwitcher } from "./FilmSimSwitcher";
import type { PhotoSidecar } from "@/lib/content/types";

interface PhotoEntryProps {
  photo: PhotoSidecar;
  /** Zero-based index of this photo within its roll (for sequence display). */
  sequenceIndex: number;
  /** Total photos in this roll. */
  rollTotal: number;
}

export function PhotoEntry({ photo, sequenceIndex, rollTotal }: PhotoEntryProps) {
  const { roll, id, caption, date, exif, variants, shareLocation, servedCoords } = photo;

  // NETRA locus string — composed from available metadata.
  // Used as both the rendered voice body and the data-netra-base-locus
  // attribute so FilmSimSwitcher can always revert without reconstruction.
  //
  // Vega (α-VOX-08) · TASK-2026-05-30-PHOTO-ENTRY-D3-NETRA-VOICE:
  // "PHOTO" label dropped (page is the photo; redundant in strip context).
  // coord segment omitted when no GPS (absence = withheld; nothing to state).
  // FilmSim extension now uses instrument codes via FilmSimSwitcher.
  const filmSimDisplay = exif?.filmSim?.toLowerCase() ?? "base";
  const coordStr = servedCoords
    ? `${servedCoords.lat.toFixed(2)}°N · ${servedCoords.lon.toFixed(2)}°E`
    : null;
  const baseLocus = coordStr
    ? `locus · ${id.toLowerCase()} · ${filmSimDisplay} · ${coordStr}`
    : `locus · ${id.toLowerCase()} · ${filmSimDisplay}`;

  // Sequence label — 1-indexed for display.
  const seqLabel = `${String(sequenceIndex + 1).padStart(3, "0")} / ${String(rollTotal).padStart(3, "0")}`;

  // Pagefind alive signal: photos use commentary.length + 1 (per spec).
  // commentary schema is DEFERRED (VISION §2.2); fallback = 1 (untended).
  const photoTendedCount = 1
  const photoTendedLast = date

  return (
    /*
     * Root element: data-photo-entry-root is the DOM marker that
     * FilmSimSwitcher mutates (root.dataset.palette = sim).
     * data-palette="base" = native unstyled image (Provia as-shot).
     * No palette CSS rule targets [data-palette="base"]; filters only
     * activate when a non-base sim is selected.
     */
    <div
      data-photo-entry-root
      data-palette="base"
      className="paper-canvas"
      style={{ position: "relative" }}
    >
      {/*
       * Pagefind search metadata — hidden from visual display.
       * data-pagefind-body marks this as the indexed body region.
       * Spec: docs/design/14-triangulate-search.md (alive signal, kind, coord)
       */}
      <div
        data-pagefind-body
        aria-hidden
        style={{ display: 'none' }}
      >
        <span data-pagefind-meta="kind">photo</span>
        <span data-pagefind-meta="fileNum">{id}</span>
        <span data-pagefind-meta="date">{date}</span>
        <span data-pagefind-meta="isoDate">{photo.isoDate}</span>
        {caption && <span data-pagefind-meta="tags">{caption}</span>}
        {coordStr && <span data-pagefind-meta="coord">{coordStr}</span>}
        {exif?.filmSim && <span data-pagefind-meta="filmSim">{exif.filmSim}</span>}
        <span data-pagefind-meta="tended-count">{String(photoTendedCount)}</span>
        <span data-pagefind-meta="tended-last">{photoTendedLast}</span>
        <span>{caption ?? id} {roll} {exif?.filmSim ?? ''}</span>
      </div>

      {/* Entry head — dashed hairline bottom, instrument register */}
      <header
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "24px",
          padding: "14px 32px 12px",
          borderBottom: "1px dashed var(--ink-dashed)",
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.22em",
          color: "var(--ink-soft)",
          textTransform: "uppercase",
          position: "relative",
          zIndex: 3,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {/* Roll + sequence */}
          <div style={{ display: "flex", gap: "14px", alignItems: "baseline" }}>
            <span>
              PHOTO —{" "}
              <span
                style={{
                  color: "var(--accent-orange)",
                  fontWeight: 500,
                  letterSpacing: "0.26em",
                }}
              >
                {seqLabel}
              </span>{" "}
              / {roll.toUpperCase()}
            </span>
          </div>

          {/* Date + film sim + camera */}
          <div style={{ display: "flex", gap: "14px", alignItems: "baseline", flexWrap: "wrap" }}>
            <span>{date}</span>
            {exif?.filmSim && (
              <>
                <span style={{ color: "var(--ink-faint)" }}>·</span>
                <span style={{ color: "var(--accent-orange)", fontWeight: 500 }}>
                  {exif.filmSim.toUpperCase()}
                </span>
              </>
            )}
            {exif?.camera && (
              <>
                <span style={{ color: "var(--ink-faint)" }}>·</span>
                <span>{exif.camera.toUpperCase()}</span>
              </>
            )}
          </div>

          {/* Coords row — only when shareLocation=true */}
          {shareLocation && servedCoords && (
            <div style={{ display: "flex", gap: "14px", alignItems: "baseline" }}>
              <span>
                {servedCoords.lat.toFixed(2)}°N · {servedCoords.lon.toFixed(2)}°E
              </span>
              <span style={{ color: "var(--ink-faint)" }}>·</span>
              <span style={{ color: "var(--ink-soft)" }}>{servedCoords.place.toUpperCase()}</span>
            </div>
          )}

          {/* Back link row — D3: links to /photos/<roll> (404 acceptable, out-of-scope) */}
          <div style={{ display: "flex", gap: "14px", alignItems: "baseline" }}>
            {/* hover states via className — photo-entry-link class defined below */}
            {/* Use Next.js Link for the homepage route (avoids no-html-link-for-pages) */}
            {/*
             * CW-14 · back-to-atlas touch target (ux-journey, α-SUR-01, 2026-06-14)
             * Was 95×31px — only path back to homepage without Nav on mobile.
             * minHeight:44px + display:inline-flex + alignItems:center → ≥44px tap zone.
             * paddingBlock:7px adds comfortable vertical room. Visual text unchanged.
             */}
            <Link
              href="/"
              className="photo-entry-link"
              style={{ display: "inline-flex", alignItems: "center", minHeight: "44px", paddingBlock: "7px" }}
            >
              [← BACK TO ATLAS]
            </Link>
            <span style={{ color: "var(--ink-faint)" }}>·</span>
            {/* D3 resolved: back-to-roll target is /photos/<roll>.
                Route does not exist yet; 404 acceptable per SHIP-PLAN §9 D3. */}
            <a
              href={`/photos/${roll}`}
              className="photo-entry-link"
            >
              [⇋ {roll.toUpperCase()}]
            </a>
          </div>
        </div>

        {/* Right readout — divergence + NETRA indicator */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            alignItems: "flex-end",
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          <span>
            α{" "}
            <span
              style={{
                fontFamily: "var(--font-type)",
                fontSize: "9.5px",
                letterSpacing: "0.04em",
                color: "var(--ink-primary)",
              }}
            >
              1.130426
            </span>
          </span>
          <span>
            NAV{" "}
            <span
              style={{
                fontFamily: "var(--font-type)",
                fontSize: "9.5px",
                letterSpacing: "0.04em",
                color: "var(--ink-primary)",
              }}
            >
              NETRA
            </span>
          </span>
        </div>
      </header>

      {/* NETRA L1 bay — always-on, solid netra-left border.
          Atom: netra-voice-strip (atlas-netra-voice from globals.css)
          data-netra-voice is the marker for FilmSimSwitcher DOM targeting
          (documented here per Betelgeuse spec impl pointer). */}
      <aside
        className="atlas-netra-voice"
        role="status"
        aria-live="polite"
        aria-label="NETRA observation bay"
        style={{
          position: "relative",
          zIndex: 3,
          /* Override the atom's default padding to match prototype 10px 32px */
          padding: "10px 32px",
        }}
      >
        <span className="voice-tag">NETRA ▸</span>
        {/*
         * D2 resolved: data-netra-voice-text is the stable selector used by
         * FilmSimSwitcher to find and update this element.
         * data-netra-base-locus stores the base locus string so FilmSimSwitcher
         * can revert to it when sim === 'base' without reconstruction.
         */}
        <span
          className="voice-body"
          data-netra-voice-text
          data-netra-base-locus={baseLocus}
        >
          {baseLocus}
        </span>
      </aside>

      {/* ── Three-column content grid [260 · 1fr · 240] ── */}
      <div
        className="photo-entry-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "260px minmax(0, 1fr) 240px",
          gap: "32px",
          padding: "32px 32px 24px",
          position: "relative",
          zIndex: 3,
        }}
      >

        {/* ── LEFT ASIDE (260) — roll context ── */}
        <aside
          aria-label="Roll context"
          style={{ minWidth: 0 }}
        >
          {/* Roll slug — INSTRUMENT label */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.3em",
              color: "var(--ink-soft)",
              textTransform: "uppercase",
              paddingBottom: "8px",
              marginBottom: "10px",
              borderBottom: "1px dashed var(--ink-dashed)",
            }}
          >
            § ROLL
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {/* Roll slug — VALUE register (Special Elite) */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.22em",
                color: "var(--ink-primary)",
                textTransform: "uppercase",
              }}
            >
              {roll}
            </span>

            {/* Sequence position */}
            <span
              style={{
                fontFamily: "var(--font-type)",
                fontSize: "11px",
                letterSpacing: "0.05em",
                color: "var(--ink-soft)",
              }}
            >
              {seqLabel}
            </span>

            {/* Date in roll */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.22em",
                color: "var(--ink-faint)",
                textTransform: "uppercase",
              }}
            >
              {date}
            </span>
          </div>

          {/* Back to roll — D3: /photos/<roll> */}
          <a
            href={`/photos/${roll}`}
            aria-label={`View full roll ${roll}`}
            className="photo-entry-link photo-entry-link--block"
          >
            [← BACK TO ROLL]
          </a>
        </aside>

        {/* ── CENTER (1fr) — paper-mount ── */}
        <main
          id="photo-main"
          style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "14px" }}
        >
          {/*
           * Atom: paper-mount (atom 17 in worldline-atoms.css).
           * 12px --paper-warm margin + 1px --ink-faint border frames the image.
           * .paper-mount class sourced from globals.css (matches skill atom).
           */}
          <figure className="paper-mount" style={{ margin: 0, width: "100%" }}>
            {/*
             * Image placeholder — variants.medium.webp when process-photos.ts
             * has run; falls back to a descriptive placeholder (Procyon follow-up
             * if variants are absent, per SHIP-PLAN §2 precondition note).
             */}
            {variants?.medium?.webp ? (
              /* CW-13 · objectFit: cover (ux-journey, α-SUR-01, 2026-06-14)
                 Browser default is objectFit:fill which stretches images without
                 preserving aspect ratio. cover preserves aspect ratio + fills the
                 container. height:auto defers to natural ratio when no container
                 height is set. */
              <img
                src={variants.medium.webp}
                alt={caption ?? `Photo ${id} from roll ${roll}`}
                className="paper-mount-image"
                style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }}
              />
            ) : (
              /* Graceful placeholder — instrument-style, no filler imagery.
               * Two data states (ground truth 2026-06-12):
               *   (a) PRE-STORE IMPORT: exif=null AND variants=null — migrated sidecar
               *       that was never ingested through the pipeline. No asset record exists.
               *       Honest label: "PRE-STORE IMPORT · NO ASSET RECORD".
               *   (b) PENDING INGEST: exif is present but variants=null — the original
               *       was uploaded but the variant pipeline (sharp) has not run yet.
               *       Honest label: "VARIANTS · PENDING INGEST". */
              <div
                className="paper-mount-image"
                role="img"
                aria-label={caption ?? `Photo ${id} from roll ${roll}`}
                style={{
                  width: "100%",
                  aspectRatio: "3 / 2",
                  background: "var(--paper-deep)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                    letterSpacing: "0.3em",
                    color: "var(--ink-faint)",
                    textTransform: "uppercase",
                  }}
                >
                  {id}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "8px",
                    letterSpacing: "0.22em",
                    color: "var(--ink-faint)",
                    textTransform: "uppercase",
                  }}
                >
                  {/* (a) migrated pre-store import — no asset record at all */}
                  {!exif ? "PRE-STORE IMPORT · NO ASSET RECORD" : "VARIANTS · PENDING INGEST"}
                </span>
              </div>
            )}

            {/* Ambient FILM SIM label at mount footer — --ink-soft 9px 0.22em.
                Suppressed when no EXIF filmSim exists (migrated pre-store imports
                have no sensor data; showing "base" with no context is misleading). */}
            {exif?.filmSim && (
              <div
                className="paper-mount-label"
                aria-hidden
              >
                {filmSimDisplay}
              </div>
            )}
          </figure>

          {/* Caption — VOICE register (Cormorant italic) */}
          {caption && (
            <figcaption
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontSize: "13px",
                color: "var(--ink-soft)",
                lineHeight: 1.6,
                margin: 0,
                maxWidth: "60ch",
              }}
            >
              {caption}
            </figcaption>
          )}
        </main>

        {/* ── RIGHT ASIDE (240) — EXIF + NETRA bay + FilmSimSwitcher ── */}
        <aside
          aria-label="Camera instrument readout"
          style={{ minWidth: 0 }}
        >
          {/* EXIF section header — INSTRUMENT register */}
          <h2
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              letterSpacing: "0.3em",
              color: "var(--ink-soft)",
              textTransform: "uppercase",
              fontWeight: 400,
              paddingBottom: "8px",
              marginBottom: "10px",
              marginTop: 0,
              borderBottom: "1px dashed var(--ink-dashed)",
            }}
          >
            § INSTRUMENT
          </h2>

          {/* EXIF <dl> — tabular-nums lock on numeric fields */}
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "78px 1fr",
              gap: "8px 12px",
              margin: 0,
              fontFamily: "var(--font-mono)",
              fontSize: "9px",
              color: "var(--ink-soft)",
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              lineHeight: 1.6,
            }}
          >
            {exif?.camera && (
              <>
                <dt>CAMERA</dt>
                <dd style={{ margin: 0, color: "var(--ink-primary)" }}>{exif.camera.toUpperCase()}</dd>
              </>
            )}
            {exif?.lens && (
              <>
                <dt>LENS</dt>
                <dd style={{ margin: 0, color: "var(--ink-primary)" }}>{exif.lens.toUpperCase()}</dd>
              </>
            )}
            {exif?.filmSim && (
              <>
                <dt>FILM</dt>
                <dd style={{ margin: 0, color: "var(--accent-orange)", fontWeight: 500 }}>
                  {exif.filmSim.toUpperCase()}
                </dd>
              </>
            )}
            {(exif?.aperture || exif?.shutter || exif?.iso) && (
              <>
                <dt>EXPOSURE</dt>
                <dd
                  style={{ margin: 0, color: "var(--ink-primary)", fontFeatureSettings: '"tnum"' }}
                >
                  {[
                    exif.aperture ? `f/${exif.aperture}` : null,
                    exif.shutter ? `1/${exif.shutter.replace("1/", "")}` : null,
                    exif.iso ? `ISO ${exif.iso}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </>
            )}
            {exif?.focal && (
              <>
                <dt>FOCAL</dt>
                <dd style={{ margin: 0, color: "var(--ink-primary)", fontFeatureSettings: '"tnum"' }}>
                  {exif.focal}mm
                  {exif.focal35 && (
                    <span
                      style={{
                        display: "block",
                        color: "var(--ink-soft)",
                        fontSize: "8.5px",
                        marginTop: "2px",
                        letterSpacing: "0.18em",
                      }}
                    >
                      35eq: {exif.focal35}mm
                    </span>
                  )}
                </dd>
              </>
            )}
            {exif?.captureTime && (
              <>
                <dt>CAPTURED</dt>
                <dd
                  style={{ margin: 0, color: "var(--ink-primary)", fontFeatureSettings: '"tnum"' }}
                >
                  {exif.captureTime}
                </dd>
              </>
            )}
            {/* Coord row — only shown when shareLocation=true */}
            {shareLocation && servedCoords ? (
              <>
                <dt>COORD</dt>
                <dd
                  style={{ margin: 0, color: "var(--ink-primary)", fontFeatureSettings: '"tnum"' }}
                >
                  {servedCoords.lat.toFixed(2)}°N · {servedCoords.lon.toFixed(2)}°E
                  <span
                    style={{
                      display: "block",
                      color: "var(--ink-soft)",
                      fontSize: "8.5px",
                      marginTop: "2px",
                      letterSpacing: "0.18em",
                    }}
                  >
                    {servedCoords.place.toUpperCase()}
                  </span>
                </dd>
              </>
            ) : (
              <>
                <dt>COORD</dt>
                <dd style={{ margin: 0, color: "var(--ink-faint)" }}>NO COORD</dd>
              </>
            )}

            {/* Variants status row — data honesty (ground truth 2026-06-12).
                (a) variants present: show "thumb / medium / full" manifest summary.
                (b) exif present but no variants: pipeline ran EXIF but not variants yet.
                (c) no exif and no variants: pre-store import — no asset record at all. */}
            <dt>ASSETS</dt>
            <dd style={{ margin: 0, color: variants ? "var(--ink-primary)" : "var(--ink-faint)" }}>
              {variants
                ? "THUMB · MEDIUM · FULL"
                : exif
                  ? "VARIANTS · PENDING INGEST"
                  : "PRE-STORE IMPORT"}
            </dd>
          </dl>

          {/* Dashed hairline separator */}
          <div
            style={{
              borderBottom: "1px dashed var(--ink-dashed)",
              margin: "16px 0",
            }}
            aria-hidden
          />

          {/* FilmSimSwitcher — client island, no state crossing the server boundary */}
          <FilmSimSwitcher />

          {/* Back-link CTA — D3: /photos/<roll> */}
          <a
            href={`/photos/${roll}`}
            aria-label={`View all photos in roll ${roll}`}
            className="photo-entry-link photo-entry-link--block"
          >
            [⇋ FULL ROLL]
          </a>
        </aside>
      </div>

      {/* Entry footer — dashed top hairline */}
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 32px",
          borderTop: "1px dashed var(--ink-dashed)",
          fontFamily: "var(--font-mono)",
          fontSize: "9px",
          letterSpacing: "0.3em",
          color: "var(--ink-soft)",
          textTransform: "uppercase",
          position: "relative",
          zIndex: 3,
        }}
      >
        <span>
          {id} · {roll}
        </span>
        <span>WORLDLINE · 1.130426</span>
      </footer>
    </div>
  );
}
