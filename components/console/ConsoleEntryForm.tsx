/**
 * components/console/ConsoleEntryForm.tsx — Entry CRUD form panel
 * ─────────────────────────────────────────────────────────────────────────────
 * Slides up from the canvas foot on node-select or + NEW ENTRY.
 * NOT a modal — translates in from the bottom of the canvas column.
 *
 * Widget upgrades (bugs #1/#2/#3a):
 *   #1 DATE  — native <input type="date"> (ISO↔dotted bridge at input boundary)
 *   #2 DOMAIN — <select> sourced from DomainSchema enum (no divergent list)
 *   #2 TAGS   — creatable combobox: chips + text input, Enter/comma adds, Backspace removes
 *   #3a SUMMARY — maxLength={300} + live "{n} / 300" counter
 *
 * Output shape (ConsoleFormData) and the persist/createEntry flow are UNCHANGED.
 * date in formData always stays dotted "YYYY.MM.DD" — conversion at input boundary only.
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

import { useState, useRef, useEffect } from 'react'
import type { ConsoleFormData, NodeKind } from './console-types'
// #2 DOMAIN: import DomainSchema as the single source of truth for domain enum values
import { DomainSchema } from '@/lib/store/schema'

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

/* ── #1 date input — hide browser chrome; native calendar still usable ─── */
input[type="date"].ef-input {
  /* color-scheme ensures the native picker respects the OS appearance */
  color-scheme: light;
  /* Remove default padding-right that appears on some browsers for the calendar icon */
  padding-right: 8px;
}
/* #1 date input: when the value is empty, show placeholder text via color trick */
input[type="date"].ef-input:not([value]),
input[type="date"].ef-input[value=""] {
  color: var(--ink-soft);
}

/* ── #2 tags combobox ───────────────────────────────────────────────────── */
.ef-tags-wrap {
  display: flex; flex-wrap: wrap; align-items: center; gap: 5px;
  border: 1px solid var(--ink-hairline); background: var(--paper-base);
  padding: 5px 8px; min-height: 34px; cursor: text;
  transition: border-color 0.2s;
}
.ef-tags-wrap:focus-within { border-color: var(--accent-orange); }
.ef-tag-chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--ink-hairline); color: var(--ink-primary);
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.12em;
  text-transform: uppercase; padding: 3px 6px; border-radius: 0;
  white-space: nowrap;
}
.ef-tag-remove {
  appearance: none; background: none; border: none;
  color: var(--ink-soft); font-size: 10px; line-height: 1; cursor: pointer;
  padding: 0; margin: 0;
  transition: color 0.15s;
}
.ef-tag-remove:hover { color: var(--accent-orange); }
.ef-tag-remove:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 1px; }
.ef-tags-input {
  appearance: none; background: transparent; border: none; outline: none;
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.01em;
  color: var(--ink-primary); min-width: 80px; flex: 1; padding: 0;
  /* min-height so the row is always tap-targetable */
  min-height: 22px;
}
.ef-tags-input::placeholder { color: var(--ink-soft); }
.ef-tags-suggestions {
  position: absolute; left: 0; right: 0; top: 100%;
  background: var(--paper-base); border: 1px solid var(--ink-hairline);
  border-top: none; z-index: 20; max-height: 120px; overflow-y: auto;
}
.ef-tags-suggestion {
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--ink-primary);
  padding: 6px 10px; cursor: pointer; transition: background 0.1s;
}
.ef-tags-suggestion:hover,
.ef-tags-suggestion[aria-selected="true"] { background: var(--accent-orange-soft); }

/* ── #3a summary counter ─────────────────────────────────────────────────── */
.ef-char-counter {
  font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--ink-faint); text-align: right;
  margin-top: 3px;
}
.ef-char-counter.is-near  { color: var(--ink-soft); }
.ef-char-counter.is-limit { color: var(--accent-orange); }

@media (prefers-reduced-motion: reduce) {
  .entry-form { transition-duration: 0.001ms; }
  .ef-openeditor, .ef-close, .ef-input, .ef-btn, .ef-commit { transition-duration: 0.001ms; }
  .ef-tags-wrap, .ef-tag-remove, .ef-tags-suggestion { transition-duration: 0.001ms; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const KIND_OPTIONS: NodeKind[] = ['article', 'photo', 'fiction', 'repo']

// #2 DOMAIN: derive options from DomainSchema enum — single source of truth.
// DomainSchema.options is the tuple of enum values typed by Zod.
const DOMAIN_OPTIONS = DomainSchema.options

// #1 DATE: convert dotted "YYYY.MM.DD" <-> ISO "YYYY-MM-DD" at the input boundary.
// formData.date stays dotted throughout; the picker sees ISO.
function dottedToIso(dotted: string): string {
  // "2026.06.18" → "2026-06-18"
  return dotted.replace(/\./g, '-')
}

function isoToDotted(iso: string): string {
  // "2026-06-18" → "2026.06.18"
  return iso.replace(/-/g, '.')
}

function todayIso(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// #2 TAGS: creatable combobox sub-component (native, no external library).
// Props mirror the field contract exactly: value=string[], onChange emits string[].

interface TagsComboboxProps {
  /** Current tag array (the formData.tags value). */
  value:     string[]
  /** Suggestions from getAllTags() passed down via knownTags. */
  knownTags: string[]
  onChange:  (tags: string[]) => void
}

function TagsCombobox({ value, knownTags, onChange }: TagsComboboxProps) {
  const [inputVal,    setInputVal]    = useState('')
  const [showSugg,    setShowSugg]    = useState(false)
  const [activeSugg,  setActiveSugg]  = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  const suggestions = inputVal.trim().length > 0
    ? knownTags.filter(
        (t) =>
          t.toLowerCase().includes(inputVal.trim().toLowerCase()) &&
          !value.includes(t),
      )
    : []

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || value.includes(tag)) { setInputVal(''); return }
    onChange([...value, tag])
    setInputVal('')
    setActiveSugg(-1)
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (activeSugg >= 0 && activeSugg < suggestions.length) {
        addTag(suggestions[activeSugg])
      } else {
        addTag(inputVal)
      }
    } else if (e.key === 'Backspace' && inputVal === '' && value.length > 0) {
      // Backspace-on-empty removes last chip
      removeTag(value[value.length - 1])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSugg((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSugg((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setShowSugg(false)
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSugg(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    // position:relative here scopes the suggestions dropdown
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div
        className="ef-tags-wrap"
        role="combobox"
        aria-expanded={showSugg && suggestions.length > 0}
        aria-haspopup="listbox"
        aria-label="Tags — type to add, Enter or comma to confirm, Backspace to remove"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span key={tag} className="ef-tag-chip">
            {tag}
            <button
              type="button"
              className="ef-tag-remove"
              aria-label={`Remove tag ${tag}`}
              onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="ef-tags-input"
          aria-label="Add tag"
          aria-autocomplete="list"
          aria-controls="ef-tags-listbox"
          aria-activedescendant={activeSugg >= 0 ? `ef-tag-opt-${activeSugg}` : undefined}
          value={inputVal}
          placeholder={value.length === 0 ? 'essay, identity…' : ''}
          onChange={(e) => {
            setInputVal(e.target.value)
            setShowSugg(true)
            setActiveSugg(-1)
          }}
          onFocus={() => setShowSugg(true)}
          onKeyDown={handleKeyDown}
          // Split on comma paste (e.g. pasting "essay, identity" creates two chips)
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (text.includes(',')) {
              e.preventDefault()
              text.split(',').forEach((s) => addTag(s))
            }
          }}
        />
      </div>
      {showSugg && suggestions.length > 0 && (
        <ul
          id="ef-tags-listbox"
          role="listbox"
          className="ef-tags-suggestions"
          aria-label="Tag suggestions"
        >
          {suggestions.map((s, i) => (
            <li
              key={s}
              id={`ef-tag-opt-${i}`}
              role="option"
              aria-selected={i === activeSugg}
              className="ef-tags-suggestion"
              onPointerDown={(e) => { e.preventDefault(); addTag(s) }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Summary max length — shared between the textarea maxLength attr and the counter display.
const SUMMARY_MAX = 300

interface ConsoleEntryFormProps {
  open:         boolean
  mode:         'new' | 'edit'
  data:         ConsoleFormData | null
  dirty:        boolean
  saving:       boolean
  /** Known tag suggestions (from getAllTags, threaded from app/console/page.tsx). */
  knownTags:    string[]
  onField:      (key: keyof ConsoleFormData, val: string | string[] | NodeKind) => void
  onClose:      () => void
  onSaveDraft:  () => void
  onCommit:     () => void
}

export function ConsoleEntryForm({
  open, mode, data, dirty, saving, knownTags, onField, onClose, onSaveDraft, onCommit,
}: ConsoleEntryFormProps) {
  // F6 hydration fix: `new Date()` inside a value prop diverges between SSR and client
  // if the component mounts near a midnight boundary. Lazy initializer runs only on the
  // client mount — stable thereafter, so SSR and hydration produce the same markup.
  const [defaultDate] = useState(() => todayIso())

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

          {/* DATE — #1: native calendar picker; ISO↔dotted bridge at input boundary.
               formData.date stays "YYYY.MM.DD" — write path / SlugDateSchema untouched. */}
          <label className="ef-field ef-col2">
            <span className="ef-label">DATE</span>
            <input
              type="date"
              className="ef-input"
              // Convert stored dotted date to ISO for the picker value.
              // Fall back to defaultDate (stable per-mount) — never inline todayIso()
              // here because new Date() differs between SSR and client hydration (F6).
              value={safe.date ? dottedToIso(safe.date) : defaultDate}
              onChange={(e) => {
                // Convert ISO picker value back to dotted before storing in formData.
                const dotted = e.target.value ? isoToDotted(e.target.value) : ''
                onField('date', dotted)
              }}
              aria-label="Entry date"
            />
          </label>

          {/* DOMAIN — #2: dropdown sourced from DomainSchema enum (single source of truth).
               Pattern mirrors KIND select above for visual consistency. */}
          <label className="ef-field ef-col2">
            <span className="ef-label">DOMAIN</span>
            <div className="ef-select-wrap">
              <select
                className="ef-input"
                value={safe.domain}
                aria-label="Entry domain"
                onChange={(e) => onField('domain', e.target.value)}
              >
                {/* Empty option so un-set entries display nothing selected */}
                <option value="">— select —</option>
                {DOMAIN_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d.toUpperCase()}</option>
                ))}
              </select>
              <span className="ef-select-caret" aria-hidden="true">▾</span>
            </div>
          </label>

          {/* TAGS — #2: creatable combobox; chips + text input + suggestions.
               Produces the same string[] as before — write path unchanged. */}
          <div className="ef-field ef-col4">
            <span className="ef-label" id="ef-tags-label">TAGS</span>
            <TagsCombobox
              value={safe.tags ?? []}
              knownTags={knownTags}
              onChange={(tags) => onField('tags', tags)}
            />
          </div>

          {/* SUMMARY — #3a: maxLength={300} + live char counter below. */}
          <label className="ef-field ef-col4">
            <span className="ef-label">SUMMARY</span>
            <textarea
              className="ef-input ef-summary"
              rows={3}
              maxLength={SUMMARY_MAX}
              value={safe.summary}
              onChange={(e) => onField('summary', e.target.value)}
              placeholder="peat's voice — the reflective register…"
            />
            {/* Live counter: color shifts near limit (≥250) and at limit (300) */}
            <span
              className={
                'ef-char-counter' +
                ((safe.summary?.length ?? 0) >= SUMMARY_MAX
                  ? ' is-limit'
                  : (safe.summary?.length ?? 0) >= SUMMARY_MAX - 50
                  ? ' is-near'
                  : '')
              }
              aria-live="polite"
              aria-label={`${safe.summary?.length ?? 0} of ${SUMMARY_MAX} characters`}
            >
              {safe.summary?.length ?? 0} / {SUMMARY_MAX}
            </span>
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
