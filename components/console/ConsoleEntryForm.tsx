/**
 * components/console/ConsoleEntryForm.tsx — Entry CRUD form panel
 * ─────────────────────────────────────────────────────────────────────────────
 * Slides up from the canvas foot on node-select or + NEW ENTRY.
 * NOT a modal — translates in from the bottom of the canvas column.
 *
 * SAVE DRAFT / COMMIT are MOCKED in Slice 2. The mock resolves after 240ms
 * (per spec) and shows a `writing…` hint. No filesystem writes.
 *
 * Navigation contract (spec §console↔editor):
 *   OPEN EDITOR ⟶ → /console/editor?kind=<kind>&slug=<fileId>
 *   Both params plumbed now; editor loading deferred to Slice 3 per Polaris scope call.
 *
 * CSS: ported from prototype "Worldline Console.html" .ef-* + .entry-form classes.
 * No new tokens added. Literal gaps reported in ConsoleApp token-gap log.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 2
 * Modeled after: console-rail.jsx EntryForm function (lines 94–160)
 * Prototype CSS: Worldline Console.html .entry-form, .ef-* (lines 117–149)
 */

'use client'

import type { ConsoleFormData, NodeKind } from './console-types'

// ─────────────────────────────────────────────────────────────────────────────
// CSS — inlined per project convention (matching ArticleEditor.tsx pattern)
// ─────────────────────────────────────────────────────────────────────────────

const FORM_CSS = `
/* ── entry form ─────────────────────────────────────────────── */
.entry-form {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 6;
  background: var(--paper-warm); border-top: 1px solid var(--ink-hairline);
  padding: 15px 20px 16px;
  transition: transform 260ms cubic-bezier(0, 0, 0.2, 1);
}
.entry-form-head {
  display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 13px;
}
.ef-head-actions { display: flex; align-items: baseline; gap: 16px; }
.ef-openeditor {
  text-decoration: none; font-family: var(--font-mono); font-size: 8.5px;
  letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent-orange);
  transition: color 0.15s;
}
.ef-openeditor:hover { color: var(--ink-primary); }
.ef-openeditor:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }
.ef-title {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--ink-primary);
}
.ef-close {
  appearance: none; background: none; border: none;
  font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.2em;
  color: var(--ink-soft); cursor: pointer; text-transform: uppercase;
  transition: color 0.15s;
}
.ef-close:hover { color: var(--accent-orange); }
.ef-close:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }

.entry-form-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 11px 14px;
}
.ef-col2 { grid-column: span 2; }
.ef-col4 { grid-column: 1 / -1; }
.ef-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.ef-label {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--ink-soft);
}
.ef-input {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.01em;
  color: var(--ink-primary); border: 1px solid var(--ink-hairline);
  background: var(--paper-base); padding: 6px 8px; border-radius: 0; outline: none;
  width: 100%; transition: border-color 0.2s;
}
.ef-input:focus { border-color: var(--accent-orange); }
.ef-summary {
  font-family: var(--font-display); font-style: italic; font-size: 13px;
  line-height: 1.4; resize: vertical; min-height: 56px;
}
.ef-select-wrap { position: relative; }
select.ef-input {
  appearance: none; padding-right: 24px; cursor: pointer;
  text-transform: uppercase; letter-spacing: 0.1em;
}
.ef-select-caret {
  position: absolute; right: 9px; top: 50%; transform: translateY(-50%);
  font-family: var(--font-type); font-size: 11px; color: var(--ink-soft);
  pointer-events: none;
}
.entry-form-actions {
  display: flex; align-items: center; gap: 14px; margin-top: 14px;
  padding-top: 13px; border-top: 1px dashed var(--ink-dashed);
}
.ef-btn {
  appearance: none; background: transparent; border: 1px solid var(--ink-hairline);
  color: var(--ink-primary); font-family: var(--font-mono); font-size: 9px;
  letter-spacing: 0.22em; text-transform: uppercase; padding: 9px 18px;
  cursor: pointer; transition: border-color 0.2s, background 0.2s, color 0.2s;
}
.ef-btn:hover { border-color: var(--accent-orange); color: var(--accent-orange); }
.ef-btn:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }
.ef-btn.is-dirty { border-color: var(--accent-orange); }
.ef-btn:disabled { opacity: 0.5; pointer-events: none; }
.ef-commit {
  background: var(--ink-primary); border-color: var(--ink-primary); color: var(--paper-base);
}
.ef-commit:hover { background: var(--accent-orange); border-color: var(--accent-orange); color: var(--paper-bright); }
.ef-hint {
  flex: 1; font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--ink-faint);
}

@media (prefers-reduced-motion: reduce) {
  .entry-form { transition-duration: 0.001ms; }
  .ef-openeditor, .ef-close, .ef-input, .ef-btn, .ef-commit { transition-duration: 0.001ms; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const KIND_OPTIONS: NodeKind[] = ['article', 'photo', 'fiction', 'repo']

interface ConsoleEntryFormProps {
  open:         boolean
  mode:         'new' | 'edit'
  data:         ConsoleFormData | null
  dirty:        boolean
  saving:       boolean
  onField:      (key: keyof ConsoleFormData, val: string | string[] | NodeKind) => void
  onClose:      () => void
  onSaveDraft:  () => void
  onCommit:     () => void
}

export function ConsoleEntryForm({
  open, mode, data, dirty, saving, onField, onClose, onSaveDraft, onCommit,
}: ConsoleEntryFormProps) {
  const safe = data ?? {
    id: '', kind: 'article' as NodeKind, fileId: '', title: '',
    date: '', domain: '', tags: [], summary: '', x: 0, y: 0,
  }

  // OPEN EDITOR URL — kind + slug (fileId). Loading deferred to Slice 3.
  const editorHref = `/console/editor?kind=${safe.kind}&slug=${safe.fileId}`

  const headLabel = mode === 'new'
    ? '◆ NEW ENTRY'
    : `EDIT · ${safe.kind.toUpperCase()} ${safe.fileId}`

  return (
    <>
      <style>{FORM_CSS}</style>
      <form
        className="entry-form"
        aria-hidden={!open}
        style={{
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          pointerEvents: open ? 'auto' : 'none',
        }}
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Form head */}
        <div className="entry-form-head">
          <span className="ef-title">{headLabel}</span>
          <div className="ef-head-actions">
            {/* OPEN EDITOR ⟶ — navigation round-trip (spec §console↔editor, point 2) */}
            <a
              className="ef-openeditor"
              href={editorHref}
              title="open the full content editor"
            >
              OPEN EDITOR ⟶
            </a>
            <button
              type="button"
              className="ef-close"
              onClick={onClose}
              aria-label="Close form (Esc)"
            >
              ESC · CLOSE
            </button>
          </div>
        </div>

        {/* Form grid */}
        <div className="entry-form-grid">
          {/* KIND */}
          <label className="ef-field ef-col2">
            <span className="ef-label">KIND</span>
            <div className="ef-select-wrap">
              <select
                className="ef-input"
                value={safe.kind}
                onChange={(e) => onField('kind', e.target.value as NodeKind)}
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k} value={k}>{k.toUpperCase()}</option>
                ))}
              </select>
              <span className="ef-select-caret" aria-hidden="true">▾</span>
            </div>
          </label>

          {/* FILE ID */}
          <label className="ef-field ef-col2">
            <span className="ef-label">FILE ID</span>
            <input
              className="ef-input"
              value={safe.fileId}
              onChange={(e) => onField('fileId', e.target.value)}
              placeholder="003"
            />
          </label>

          {/* TITLE */}
          <label className="ef-field ef-col4">
            <span className="ef-label">TITLE</span>
            <input
              className="ef-input"
              value={safe.title}
              onChange={(e) => onField('title', e.target.value)}
              placeholder="lower-case title…"
            />
          </label>

          {/* DATE */}
          <label className="ef-field ef-col2">
            <span className="ef-label">DATE</span>
            <input
              className="ef-input"
              value={safe.date}
              onChange={(e) => onField('date', e.target.value)}
              placeholder="YYYY.MM.DD"
            />
          </label>

          {/* DOMAIN */}
          <label className="ef-field ef-col2">
            <span className="ef-label">DOMAIN</span>
            <input
              className="ef-input"
              value={safe.domain}
              onChange={(e) => onField('domain', e.target.value)}
              placeholder="method"
            />
          </label>

          {/* TAGS */}
          <label className="ef-field ef-col4">
            <span className="ef-label">TAGS</span>
            <input
              className="ef-input"
              value={(safe.tags ?? []).join(', ')}
              onChange={(e) =>
                onField('tags', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
              }
              placeholder="essay, identity"
            />
          </label>

          {/* SUMMARY */}
          <label className="ef-field ef-col4">
            <span className="ef-label">SUMMARY</span>
            <textarea
              className="ef-input ef-summary"
              rows={3}
              value={safe.summary}
              onChange={(e) => onField('summary', e.target.value)}
              placeholder="peat's voice — the reflective register…"
            />
          </label>
        </div>

        {/* Action bar */}
        <div className="entry-form-actions">
          <button
            type="button"
            className={'ef-btn' + (dirty ? ' is-dirty' : '')}
            disabled={saving}
            onClick={onSaveDraft}
          >
            SAVE DRAFT
          </button>
          <span className="ef-hint" aria-live="polite">
            {saving ? 'writing…' : dirty ? 'unsaved changes' : '·'}
          </span>
          <button
            type="button"
            className="ef-btn ef-commit"
            disabled={saving}
            onClick={onCommit}
          >
            COMMIT
          </button>
        </div>
      </form>
    </>
  )
}
