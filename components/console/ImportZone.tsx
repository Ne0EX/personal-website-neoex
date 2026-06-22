/**
 * components/console/ImportZone.tsx — Atlas Console · cross-kind import surface
 * ─────────────────────────────────────────────────────────────────────────────
 * 'use client' — local drag/confirm state + a file-input ref.
 *
 * Two surfaces in one component (cross-kind ImportZone, contract §7 + §"cross-kind
 * surfaces · ImportZone + ↻ RE-IMPORT"):
 *
 *   1. EMPTY STATE  (hasContent === false)
 *      Dashed-border drop target filling the source-pane area. Centered vertical
 *      content: "IMPORT ZONE" head · [↑ IMPORT ENTRY] button (.ed-btn-primary) ·
 *      Cormorant-italic descriptive copy. Drag-over → dashed border turns
 *      var(--accent-orange) with NO fill (orange is an interaction signal, not a
 *      static decoration). role="region" aria-label="Import zone",
 *      aria-dropeffect="copy", aria-grabbed="false".
 *
 *   2. RE-IMPORT helper  (hasContent === true)
 *      A toolbar-row control: `↻ RE-IMPORT` (.ed-btn-ghost). On click it does NOT
 *      open a modal — it swaps the button row for an inline confirmation:
 *      `REPLACE CURRENT CONTENT?  [CONFIRM] [CANCEL]` (mono 9px, ink-primary,
 *      CONFIRM = ink-primary filled, CANCEL = ghost). ESC cancels the confirm.
 *
 * SOUL DRIFT CORRECTIONS applied (contract §soul anchoring):
 *   - Prototype `.iz-drop.is-drag { background: rgba(212,96,42,0.05) }` (filled
 *     drag feedback = SaaS) → border-color change ONLY, no fill.
 *   - Prototype `.iz-spin` converting spinner → DROPPED. A spinner is SaaS; this
 *     surface is input-only (no auto-convert/extract in this slice).
 *   - Prototype `.iz-chips` (MDX / .DOCX / .PDF / START BLANK source matrix) →
 *     DROPPED. Out of scope: this slice's import surface is a single drop target
 *     + IMPORT ENTRY button bound to the contract's onImport(file) seam.
 *
 * Bound EXACTLY to the contract's ImportZoneProps. Caller (the entry editor)
 * owns reading the File (onImport) and the re-import side effect (onReImport);
 * this component is a presentation + interaction shell only.
 *
 * Scoped component-local CSS (ConsoleRail / ArticleEditor pattern). Composes
 * from master-DS tokens; does NOT edit app/globals.css.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor
 * Reference (deviated with purpose): editor-engine.jsx ImportZone@164,
 *   editor-kinds.jsx EntryToolbar `.ed-import`@68, "Article Editor.html" .iz-* / .ed-empty.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Props — bound EXACTLY to the contract's ImportZoneProps (atlas-console-full-
// editor.md §"prop contracts · 7. ImportZone"). Defined locally: editor-types.ts
// holds the SHARED data/enum types (EntryKind, PhotoFrame, …); the per-component
// prop interfaces from contract §7 are co-located with their component (the
// contract states "Props are TypeScript-shaped here; Sirius writes the
// implementation"). ImportZone consumes no shared data type — only File + scalars
// — so it imports nothing from editor-types.
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportZoneProps {
  /** Caller handles reading the File (FileReader / blob URL). */
  onImport: (file: File) => void
  /** false → show the empty-state drop target · true → show ↻ RE-IMPORT control. */
  hasContent: boolean
  /** Called after the re-import is confirmed (only meaningful when hasContent). */
  onReImport?: () => void
  /** true → read-only mode: suppress all import controls (render nothing). */
  reading?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoped styles — `.iz-*` prefix (import-zone), mirrors the prototype namespace.
//
// .ed-btn-primary / .ed-btn-ghost are the shared instrument button atoms the
// contract names (tokens table + §soul anchoring: "PUBLISH button → .ed-btn-primary
// — same instrument button class used in existing console"). The contract places
// the canonical definition in ArticleEditor.tsx — which a CONCURRENT polish pass
// owns and will likely (re)define. To avoid a nondeterministic global cascade
// collision (two global defs resolved by source order, which can differ across
// mounts → hover/padding flicker), these are SCOPED under this component's own
// subtree (.iz / .iz-reimport). Scoped selectors win inside this component by
// specificity; when the real shared atom lands globally it governs everywhere
// else. No global redefinition leaks out of this leaf.
// ─────────────────────────────────────────────────────────────────────────────

const IMPORTZONE_CSS = `
/* ── instrument buttons — scoped to this component's subtree (no global leak) ─ */
.iz .ed-btn-primary,
.iz-reimport .ed-btn-primary {
  appearance: none;
  background: var(--btn-fill);          /* semantic fill token */
  border: 1px solid var(--btn-fill);
  color: var(--btn-fill-fg);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 11px 18px;
  min-height: 44px;            /* touch target ≥ 44px (contract §breakpoints) */
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.iz .ed-btn-primary:hover,
.iz-reimport .ed-btn-primary:hover {
  background: var(--accent-orange);
  border-color: var(--accent-orange);
  color: var(--paper-bright);
}
.iz .ed-btn-primary:focus-visible,
.iz-reimport .ed-btn-primary:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

.iz .ed-btn-ghost,
.iz-reimport .ed-btn-ghost {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  color: var(--ink-faint);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 9px 13px;
  min-height: 44px;            /* touch target ≥ 44px */
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}
.iz .ed-btn-ghost:hover,
.iz-reimport .ed-btn-ghost:hover {
  border-color: var(--accent-orange);
  color: var(--ink-primary);
}
.iz .ed-btn-ghost:focus-visible,
.iz-reimport .ed-btn-ghost:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

/* ── empty-state drop target ───────────────────────────────────────────── */
.iz {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 0;
  overflow-y: auto;
  padding: 30px;
  background: var(--paper-base);
}
.iz-drop {
  width: min(560px, 92%);
  border: 1px dashed var(--ink-dashed);
  /* border-color is the ONLY drag signal — no fill (soul drift correction). */
  background: transparent;
  padding: 52px 34px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: border-color 100ms ease;   /* contract motion: drag-over 100ms */
}
.iz-drop.is-drag,
.iz-drop:hover,
.iz-drop:focus-visible {
  border-color: var(--accent-orange);
  outline: none;
}
/* Glyph is a quiet at-rest marker, NOT orange: orange is reserved as the
   drag/hover interaction signal (contract §ImportZone + soul drift). Coloring
   it orange at rest would blunt the border-color state change the drop target
   uses for that signal. */
.iz-glyph {
  font-size: 24px;
  line-height: 1;
  color: var(--ink-faint);
}
.iz-head {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-primary);
}
/* Cormorant italic descriptive copy (contract typography: import zone copy
   = Cormorant Garamond 13px italic, ink-soft). --font-display = Cormorant. */
.iz-copy {
  font-family: var(--font-display);
  font-size: 13px;
  font-style: italic;
  line-height: 1.5;
  color: var(--ink-soft);
  margin: 0;
}
.iz-copy b {
  color: var(--ink-primary);
  font-style: italic;
  font-weight: 400;
}

/* ── re-import helper (toolbar-row control) ────────────────────────────── */
.iz-reimport {
  display: inline-flex;
  align-items: center;
}
.iz-confirm {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-primary);
  /* inline-confirm fade-in (contract motion: import confirm inline 150ms ease) */
  animation: iz-confirm-in 150ms ease;
}
.iz-confirm-q {
  white-space: nowrap;
}
.iz-confirm-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
/* Inline confirm buttons live in the toolbar row — trim HORIZONTAL padding to
   fit the row, but keep the 44px touch floor (contract §breakpoints: all
   interactive elements ≥ 44px height). */
.iz-reimport .iz-confirm .ed-btn-primary,
.iz-reimport .iz-confirm .ed-btn-ghost {
  padding: 7px 12px;
  min-height: 44px;
}

@keyframes iz-confirm-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .iz .ed-btn-primary,
  .iz .ed-btn-ghost,
  .iz-reimport .ed-btn-primary,
  .iz-reimport .ed-btn-ghost,
  .iz-drop { transition: none; }
  .iz-confirm { animation: none; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// ImportZone — empty-state drop target + RE-IMPORT inline-confirm helper.
// Bound exactly to the contract's ImportZoneProps.
// ─────────────────────────────────────────────────────────────────────────────

export function ImportZone({ onImport, hasContent, onReImport, reading }: ImportZoneProps) {
  // Drag-over highlight (empty state).
  const [drag, setDrag] = useState(false)
  // Re-import inline confirmation visibility (hasContent state).
  const [confirming, setConfirming] = useState(false)
  // Hidden <input type=file> ref — caller-owned File read happens via onImport.
  const fileRef = useRef<HTMLInputElement>(null)

  // ESC cancels the re-import confirmation (contract keyboard map: ESC cancels
  // re-import confirm). Bound only while the confirm row is open.
  useEffect(() => {
    if (!confirming) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setConfirming(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming])

  const pickFile = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) onImport(f)
      // Reset the input so picking the same file again re-fires change.
      e.target.value = ''
    },
    [onImport],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDrag(false)
      const f = e.dataTransfer.files?.[0]
      if (f) onImport(f)
    },
    [onImport],
  )

  const confirmReImport = useCallback(() => {
    setConfirming(false)
    onReImport?.()
  }, [onReImport])

  // Read-only mode: import controls are entirely suppressed (contract states:
  // ImportZone · reading → hidden). Render nothing.
  if (reading) return null

  // ── RE-IMPORT helper (content already loaded) ───────────────────────────
  // The contract places `↻ RE-IMPORT` in the toolbar row (NOT the empty zone);
  // this branch returns just the inline control for the toolbar to host.
  if (hasContent) {
    return (
      <>
        <style>{IMPORTZONE_CSS}</style>
        <span className="iz-reimport">
          {confirming ? (
            <span className="iz-confirm" role="alertdialog" aria-label="Replace current content">
              <span className="iz-confirm-q">REPLACE CURRENT CONTENT?</span>
              <span className="iz-confirm-actions">
                <button
                  type="button"
                  className="ed-btn-primary"
                  onClick={confirmReImport}
                  autoFocus
                >
                  CONFIRM
                </button>
                <button
                  type="button"
                  className="ed-btn-ghost"
                  onClick={() => setConfirming(false)}
                >
                  CANCEL
                </button>
              </span>
            </span>
          ) : (
            <button
              type="button"
              className="ed-btn-ghost"
              onClick={() => setConfirming(true)}
              title="replace current content"
            >
              ↻ RE-IMPORT
            </button>
          )}
        </span>
      </>
    )
  }

  // ── EMPTY STATE drop target (no content loaded) ─────────────────────────
  return (
    <>
      <style>{IMPORTZONE_CSS}</style>
      <section
        className="iz"
        role="region"
        aria-label="Import zone"
      >
        <div
          className={'iz-drop' + (drag ? ' is-drag' : '')}
          role="button"
          tabIndex={0}
          aria-dropeffect="copy"
          aria-grabbed="false"
          onClick={pickFile}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              pickFile()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".md,.mdx,image/*"
            style={{ display: 'none' }}
            onChange={onFile}
            aria-hidden
            tabIndex={-1}
          />
          <span className="iz-glyph" aria-hidden>◇</span>
          <span className="iz-head">IMPORT ZONE</span>
          {/* IMPORT ENTRY action — .ed-btn-primary (contract §ImportZone).
              type=button + stopPropagation so the button click doesn't double-fire
              the drop target's onClick (both open the picker). */}
          <button
            type="button"
            className="ed-btn-primary"
            onClick={(e) => {
              e.stopPropagation()
              pickFile()
            }}
          >
            ↑ IMPORT ENTRY
          </button>
          <p className="iz-copy">
            — or drag a <b>markdown</b> / <b>image</b> file here —
          </p>
        </div>
      </section>
    </>
  )
}

export default ImportZone
