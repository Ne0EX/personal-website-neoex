/**
 * components/console/QuickUploadBar.tsx — Frictionless photo drop zone
 * ─────────────────────────────────────────────────────────────────────────────
 * 'use client' — drag/file state lives here.
 *
 * Dead-simple upload surface for the console front door. Peat drops pretty
 * photos and they're live — no roll picker, no instrument fields, no publish
 * gate. The rich instrument editor already exists in EntryEditor; this is the
 * "just want to upload a photo" path.
 *
 * Flow (per Altair's quickUploadPhoto contract):
 *   1. User drops file(s) onto the zone (or clicks to pick — accepts multiple).
 *   2. Each file is uploaded to the `originals` bucket (browser Supabase client).
 *   3. quickUploadPhoto server action auto-creates the roll from EXIF capture
 *      month (or current month fallback) and publishes the entry.
 *   4. Per-file status: idle → uploading → processing → done | failed.
 *   5. On any success: link to /photos/<roll> appears ("see them").
 *   6. A small "edit details" link per done file leads to the instrument editor.
 *
 * Placement: between the console header and the two-pane body in ConsoleApp.
 * The bar collapses (height 0, overflow hidden) once all uploads are done AND
 * the user dismisses it (or after 8 s auto-dismiss). It expands again on the
 * next drop event so it's always available without reloading.
 *
 * Design idiom: Worldline console — calm, mono, dashed borders, orange only as
 * interaction signal. No explainer bloat.
 *
 * Owner: Sirius (α-SUR-01) · simple-upload track
 * Modeled after: ImportZone.tsx (drag pattern), EntryEditor.tsx uploadAndIngest
 *   (storage-first → server action two-step).
 * Design tokens: all from app/globals.css (no raw hex / raw px outside scale).
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type UploadStatus = 'uploading' | 'processing' | 'done' | 'failed'

interface FileUpload {
  /** Stable key derived from filename + upload batch timestamp. */
  key: string
  name: string
  status: UploadStatus
  /** Populated on success — the roll slug the photo landed in. */
  roll: string | null
  /** Populated on success — the photo entry slug (roll/photoId). */
  entrySlug: string | null
  /** Human-readable error message on failure. */
  errorMsg: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoped CSS — .qub-* prefix (quick-upload-bar).
// All colours reference CSS variables from app/globals.css; no raw hex.
// ─────────────────────────────────────────────────────────────────────────────

const QUB_CSS = `
/* ── bar container — sits between console header and two-pane body ── */
.qub-bar {
  flex-shrink: 0;
  border-bottom: 1px dashed var(--ink-dashed);
  background: var(--paper-base);
  overflow: hidden;
  transition: max-height 280ms ease, opacity 280ms ease;
}
.qub-bar.is-collapsed {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
  border-bottom-color: transparent;
}
.qub-bar.is-expanded {
  max-height: 280px;
  opacity: 1;
}

/* ── drop zone inner layout ── */
.qub-drop {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 20px;
  cursor: pointer;
  transition: border-color 100ms ease;
  min-height: 54px;
  position: relative;
}
.qub-drop.is-drag {
  background: rgb(var(--accent-orange-rgb) / 0.04);
}
.qub-drop.is-drag .qub-zone-border {
  border-color: var(--accent-orange);
}

/* Dashed border overlay (the whole-bar drop affordance) */
.qub-zone-border {
  position: absolute;
  inset: 6px 14px;
  border: 1px dashed var(--ink-dashed);
  pointer-events: none;
  transition: border-color 100ms ease;
  border-radius: 1px;
}

/* Glyph + label */
.qub-glyph {
  font-family: var(--font-mono);
  font-size: 16px;
  color: var(--ink-faint);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  user-select: none;
}
.qub-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-soft);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.qub-hint {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 12px;
  color: var(--ink-faint);
  position: relative;
  z-index: 1;
}

/* ── per-file status list ── */
.qub-files {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0 20px 10px;
  max-height: 160px;
  overflow-y: auto;
}
.qub-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
}
.qub-file:first-child { border-top: none; }

.qub-file-name {
  color: var(--ink-soft);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.qub-file-status {
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.15em;
}
.qub-file-status.is-uploading  { color: var(--ink-soft); }
.qub-file-status.is-processing { color: var(--accent-orange); }
.qub-file-status.is-done       { color: var(--ink-primary); }
.qub-file-status.is-failed     { color: #c0392b; }  /* semantic error — no token for red yet */

.qub-file-action {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.12em;
  text-decoration: none;
  text-transform: uppercase;
  color: var(--accent-orange);
  border-bottom: 1px dashed var(--accent-orange);
  white-space: nowrap;
}
.qub-file-action:hover { opacity: 0.75; }
.qub-file-action:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

/* ── success strip (shows after all done) ── */
.qub-success {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 20px 12px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
}
.qub-success-label {
  color: var(--ink-primary);
  text-transform: uppercase;
}
.qub-success-link {
  color: var(--accent-orange);
  text-decoration: none;
  border-bottom: 1px dashed var(--accent-orange);
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 9px;
  font-family: var(--font-mono);
}
.qub-success-link:hover { opacity: 0.75; }
.qub-success-link:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.qub-dismiss {
  margin-left: auto;
  appearance: none;
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-faint);
  cursor: pointer;
  padding: 4px 6px;
  min-height: 32px;
}
.qub-dismiss:hover { color: var(--ink-primary); }
.qub-dismiss:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .qub-bar, .qub-drop, .qub-zone-border { transition: none; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function QuickUploadBar() {
  const [files, setFiles]     = useState<FileUpload[]>([])
  const [drag, setDrag]       = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Auto-dismiss timer ref — cleared if user interacts before timeout
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Derived: is every file in a terminal state? ──
  const allDone = files.length > 0 && files.every((f) => f.status === 'done' || f.status === 'failed')
  const anySuccess = files.some((f) => f.status === 'done')

  // First successful roll — used for the "see them" link.
  // Multiple photos may land in different rolls (different EXIF months); we link
  // to the first successful one for simplicity. A future track can list all rolls.
  const firstSuccessRoll = files.find((f) => f.status === 'done' && f.roll)?.roll ?? null

  // ── Auto-dismiss after 8 s once all files are done ──
  useEffect(() => {
    if (!allDone) return
    dismissTimer.current = setTimeout(() => setCollapsed(true), 8000)
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [allDone])

  // ── Re-expand on new drop (so the bar is always available without reload) ──
  const expand = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    setCollapsed(false)
  }, [])

  // ── Core upload function: file → originals bucket → quickUploadPhoto ──
  const uploadFile = useCallback(async (file: File, batchTs: number) => {
    // Derive a stable key for this upload
    const base = file.name.replace(/\.[^.]+$/, '').toUpperCase().replace(/[^A-Z0-9_-]/g, '') || 'PHOTO'
    const photoId = base.slice(0, 12)
    const ext     = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    // Add batchTs suffix to avoid collision when the same filename is dropped twice
    const uniquePhotoId = `${photoId}-${batchTs}`
    const originalKey   = `quick-uploads/${uniquePhotoId}.${ext}`
    const fileKey       = `${file.name}-${batchTs}`

    // Register as uploading
    setFiles((fs) => [...fs, {
      key: fileKey, name: file.name,
      status: 'uploading', roll: null, entrySlug: null, errorMsg: null,
    }])

    const patch = (updates: Partial<FileUpload>) =>
      setFiles((fs) => fs.map((f) => f.key === fileKey ? { ...f, ...updates } : f))

    try {
      // Step 1: upload original to `originals` bucket (browser client, DL3 pattern)
      const { createSupabaseBrowserClient } = await import('@/lib/store/supabase/browser')
      const supabase = createSupabaseBrowserClient()
      const { error: uploadErr } = await supabase.storage
        .from('originals')
        .upload(originalKey, file, { upsert: false })

      if (uploadErr) {
        patch({ status: 'failed', errorMsg: `storage: ${uploadErr.message}` })
        return
      }

      patch({ status: 'processing' })

      // Step 2: quickUploadPhoto server action — auto-roll + publish
      const { quickUploadPhoto } = await import('@/lib/server/store/actions')
      const result = await quickUploadPhoto({ originalKey, photoId: uniquePhotoId })

      if (!result.ok) {
        patch({ status: 'failed', errorMsg: result.error.message })
        return
      }

      patch({
        status: 'done',
        roll: result.roll,
        entrySlug: result.entry.slug,
      })
    } catch (thrown) {
      const msg = thrown instanceof Error ? thrown.message : String(thrown)
      patch({ status: 'failed', errorMsg: `unexpected: ${msg}` })
    }
  }, [])

  // ── Handle file selection (from drop or picker) ──
  const handleFiles = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return
    expand()
    const batchTs = Date.now()
    for (const file of Array.from(incoming)) {
      void uploadFile(file, batchTs)
    }
  }, [expand, uploadFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    expand()
    setDrag(true)
  }, [expand])

  const onDragLeave = useCallback(() => setDrag(false), [])

  const onPickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // Reset so picking the same file again fires change
    e.target.value = ''
  }, [handleFiles])

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    setCollapsed(true)
    // Clear file list so the bar is fresh next time it expands
    setFiles([])
  }, [])

  return (
    <>
      <style>{QUB_CSS}</style>

      {/* The whole bar is also a drag target — DragOver on the outer bar expands+re-opens */}
      <div
        className={`qub-bar ${collapsed ? 'is-collapsed' : 'is-expanded'}`}
        role="region"
        aria-label="Quick photo upload"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Hidden multi-file picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={onPickerChange}
          aria-hidden
          tabIndex={-1}
        />

        {/* ── Drop zone row — always visible when bar is open ── */}
        <div
          className={`qub-drop${drag ? ' is-drag' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Drop photos here or click to pick"
          aria-dropeffect="copy"
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openPicker()
            }
          }}
        >
          <div className="qub-zone-border" aria-hidden />
          <span className="qub-glyph" aria-hidden>◈</span>
          <span className="qub-label">drop photos</span>
          <span className="qub-hint">click to pick · or drag multiple files</span>
        </div>

        {/* ── Per-file status list — appears as files are added ── */}
        {files.length > 0 && (
          <ul className="qub-files" role="list" aria-label="Upload progress">
            {files.map((f) => (
              <li key={f.key} className="qub-file">
                <span className="qub-file-name" title={f.name}>{f.name}</span>
                <span
                  className={`qub-file-status is-${f.status}`}
                  aria-label={`status: ${f.status}`}
                >
                  {f.status === 'uploading'  ? 'UP…'    :
                   f.status === 'processing' ? 'PROC…'  :
                   f.status === 'done'       ? 'DONE'   :
                   /* failed */                'FAILED' }
                </span>
                {f.status === 'done' && f.entrySlug && (
                  <a
                    href={`/photos/${f.entrySlug}`}
                    className="qub-file-action"
                    aria-label={`view ${f.name}`}
                  >
                    VIEW
                  </a>
                )}
                {f.status === 'done' && f.entrySlug && (
                  <a
                    href={`/console/editor?kind=photo&slug=${encodeURIComponent(f.entrySlug)}`}
                    className="qub-file-action"
                    aria-label={`edit details for ${f.name}`}
                  >
                    EDIT
                  </a>
                )}
                {f.status === 'failed' && f.errorMsg && (
                  <span
                    className="qub-file-status is-failed"
                    title={f.errorMsg}
                    aria-label={`error: ${f.errorMsg}`}
                  >
                    [{f.errorMsg.slice(0, 32)}{f.errorMsg.length > 32 ? '…' : ''}]
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* ── Success strip — link to the roll + dismiss ── */}
        {allDone && anySuccess && firstSuccessRoll && (
          <div className="qub-success" role="status" aria-live="polite">
            <span className="qub-success-label">uploaded</span>
            <a
              href={`/photos/${firstSuccessRoll}`}
              className="qub-success-link"
              aria-label={`see photos in roll ${firstSuccessRoll}`}
            >
              see them →
            </a>
            <button
              type="button"
              className="qub-dismiss"
              onClick={dismiss}
              aria-label="Dismiss upload bar"
            >
              [ clear ]
            </button>
          </div>
        )}
        {/* Failed-only state — no success link, just dismiss */}
        {allDone && !anySuccess && (
          <div className="qub-success" role="alert">
            <span className="qub-success-label" style={{ color: '#c0392b' }}>upload failed</span>
            <button type="button" className="qub-dismiss" onClick={dismiss}>
              [ clear ]
            </button>
          </div>
        )}
      </div>
    </>
  )
}
