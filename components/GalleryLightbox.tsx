/**
 * GalleryLightbox.tsx — client component
 * ─────────────────────────────────────────────────────────────────────────────
 * Fullscreen photo lightbox for the /photos gallery index.
 *
 * Design reference: docs/design/SPEC-2026-06-14-photo-gallery.md §lightbox
 *
 * Spec summary:
 *   - Overlay: var(--paper-base) at 96% opacity. No blur, no gradient.
 *   - Image: full.avif if available, else medium.webp.
 *     max-width: 90vw, max-height: 90vh, object-fit: contain.
 *   - Navigation: ← / → keys cycle within current roll group. No visible
 *     arrows (keyboard only). Mobile (<600px): lightbox skipped — enforced
 *     by GalleryGrid's cell click handler checking window.innerWidth.
 *   - [ESC] button + Escape key close. Click directly on overlay also closes.
 *   - [⇋ OPEN ENTRY] links to /photos/<roll>/<id>.
 *   - Motion: open = overlay opacity 0→1 (220ms ease) + image scale 0.97→1
 *     (220ms cubic-bezier(0.2,0.8,0.2,1)); close = 120ms ease-in opacity→0.
 *     Prev/next cross-fade: 100ms out / 150ms in.
 *   - prefers-reduced-motion: globals.css collapses all transitions to 0.001ms.
 *     The keyframes below inherit that collapse via globals.css
 *     `*, *::before, *::after { animation: none !important; transition-duration: 0.001ms !important; }`.
 *   - a11y: role="dialog" aria-modal, focus trapped, focus returns to cell.
 *
 * Modeled after: TriangulateSearch.tsx (client portal overlay pattern).
 *
 * Owner: Sirius (α-SUR-01) · gallery-view slice
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import type { PhotoVariants } from "@/lib/content/types";

export interface LightboxPhoto {
  roll: string;
  id: string;
  caption?: string;
  /** Display date, e.g. "2026.05.12" */
  date: string;
  /** Variants — undefined for placeholder-only migrated photos. */
  variants?: PhotoVariants;
}

interface GalleryLightboxProps {
  /** The photo currently shown (null = lightbox closed). */
  photo: LightboxPhoto | null;
  /** All photos in the same roll as photo, in capture order (for ← / → nav). */
  rollPhotos: LightboxPhoto[];
  onClose: () => void;
  onNavigate: (photo: LightboxPhoto) => void;
  /** DOM id of the gallery-cell that triggered open — for focus return on close. */
  originCellId?: string;
}

export function GalleryLightbox({
  photo,
  rollPhotos,
  onClose,
  onNavigate,
  originCellId,
}: GalleryLightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // imageFade: drives cross-fade opacity transition on prev/next
  const [imageFade, setImageFade] = useState<"in" | "out">("in");

  // closing: drives close animation (overlay fades out, then display:none)
  const [closing, setClosing] = useState(false);

  // mounted guard — avoids SSR hydration mismatch with createPortal.
  // queueMicrotask defers setState out of the effect body
  // (react-hooks/set-state-in-effect pattern per TriangulateSearch.tsx:1453).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // ── Close with animation ─────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 120);
  }, [onClose]);

  // ── Prev / next navigation with cross-fade ───────────────────────────────
  const navigate = useCallback(
    (direction: -1 | 1) => {
      if (!photo || rollPhotos.length <= 1) return;
      const idx = rollPhotos.findIndex((p) => p.id === photo.id);
      if (idx === -1) return;
      const next = rollPhotos[(idx + direction + rollPhotos.length) % rollPhotos.length];
      setImageFade("out");
      setTimeout(() => {
        onNavigate(next);
        setImageFade("in");
      }, 100);
    },
    [photo, rollPhotos, onNavigate]
  );

  // ── Keyboard handling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!photo) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")       { handleClose(); return; }
      if (e.key === "ArrowLeft")    { e.preventDefault(); navigate(-1); return; }
      if (e.key === "ArrowRight")   { e.preventDefault(); navigate(1);  return; }
      // Focus trap within overlay
      if (e.key === "Tab" && overlayRef.current) {
        const focusable = Array.from(
          overlayRef.current.querySelectorAll<HTMLElement>(
            'button, a[href], [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [photo, handleClose, navigate]);

  // ── Focus management + scroll lock ──────────────────────────────────────
  const prevPhotoIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (photo && !prevPhotoIdRef.current) {
      // Opening: send focus to close button; lock body scroll
      setTimeout(() => closeButtonRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else if (!photo && prevPhotoIdRef.current) {
      // Closed: restore body scroll; return focus to origin cell
      document.body.style.overflow = "";
      if (originCellId) {
        const cell = document.getElementById(originCellId);
        (cell as HTMLElement | null)?.focus();
      }
    }
    prevPhotoIdRef.current = photo?.id ?? null;
  }, [photo, originCellId]);

  // Cleanup scroll lock on unmount (component teardown)
  useEffect(() => () => { document.body.style.overflow = ""; }, []);

  // ── bfcache guard: clear body.overflow before page enters the cache ──────
  // Without this, navigating away via [⇋ OPEN ENTRY] while the lightbox is
  // open leaves body.overflow="hidden" in the page state captured by bfcache.
  // When the user hits browser Back, the page restores with overflow:hidden and
  // renders blank (white screen on back — fix #3, 2026-06-14).
  //
  // pagehide fires just before the page is unloaded or entered into bfcache.
  // We clear overflow on pagehide unconditionally so the restored page
  // is always scrollable regardless of lightbox state at navigation time.
  useEffect(() => {
    const onPageHide = () => {
      document.body.style.overflow = "";
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  if (!mounted || !photo) return null;

  // Image source — prefer full.avif → medium.webp → null (placeholder)
  const imageSrc =
    photo.variants?.full?.avif  ??
    photo.variants?.medium?.webp ??
    null;

  // Overlay click: close only when clicking the backdrop itself
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) handleClose();
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    // var(--paper-base) at 96% opacity via rgb() + CSS var
    background: "rgb(var(--paper-base-rgb) / 0.96)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    // open/close opacity animation — reduced-motion collapse via globals.css
    opacity: closing ? 0 : 1,
    transition: closing
      ? "opacity 120ms ease-in"
      : "opacity 220ms ease",
  };

  const overlay = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${photo.id} from roll ${photo.roll}`}
      onClick={handleOverlayClick}
      style={overlayStyle}
    >
      {/* ── Keyframes for image scale-in (injected once per mount) ── */}
      {/*
       * These keyframes are scoped to this component's render.
       * The globals.css prefers-reduced-motion rule collapses them to 0.001ms.
       * We cannot add @keyframes to globals.css (Betelgeuse's territory).
       */}
      <style>{`
        @keyframes lb-img-open {
          from { transform: scale(0.97); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>

      {/* ── Top bar: [⇋ OPEN ENTRY] (left) + [ESC] (right) ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
        }}
      >
        {/* [⇋ OPEN ENTRY] — t-mono 9px ink-soft — links to per-photo entry */}
        <a
          href={`/photos/${photo.roll}/${photo.id}`}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--meta-size)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
            textDecoration: "none",
            // focus-visible orange outline (site-wide standard)
            outline: "none",
          }}
          aria-label={`Open full entry for photo ${photo.id}`}
        >
          [⇋ OPEN ENTRY]
        </a>

        {/* [ESC] close button — t-mono 9px ink-faint */}
        <button
          ref={closeButtonRef}
          onClick={handleClose}
          aria-label="Close"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--meta-size)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
            padding: "4px 8px",
            outline: "none",
          }}
        >
          [ESC]
        </button>
      </div>

      {/* ── Image + meta ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "16px",
          // slight downward offset to clear top bar
          marginTop: "32px",
          // constrain to viewport — ensures meta text doesn't overflow
          maxWidth: "90vw",
        }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={photo.caption ?? `Photo ${photo.id} from roll ${photo.roll}`}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              objectFit: "contain",
              display: "block",
              // prev/next cross-fade transition (reduced-motion collapsed by globals.css)
              transition: "opacity 150ms ease",
              opacity: imageFade === "out" ? 0 : 1,
              // open scale animation
              animation: imageFade === "in"
                ? "lb-img-open 220ms cubic-bezier(0.2,0.8,0.2,1) forwards"
                : "none",
            }}
          />
        ) : (
          /* Defensive placeholder — lightbox should not open for no-image cells,
             but renders gracefully if it somehow does. */
          <div
            style={{
              width: "min(90vw, 480px)",
              aspectRatio: "3 / 2",
              background: "var(--paper-deep)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            role="img"
            aria-label={`No image available — Photo ${photo.id} from roll ${photo.roll}`}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "var(--meta-size)",
                letterSpacing: "0.3em",
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

        {/* Meta row — ID · date (t-mono 9px ink-faint) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--meta-size)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            {photo.id} · {photo.date}
          </span>
          {/* Caption — Cormorant italic 12px ink-soft (spec) */}
          {photo.caption && (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontSize: "12px",
                color: "var(--ink-soft)",
                lineHeight: 1.5,
              }}
            >
              {photo.caption}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
