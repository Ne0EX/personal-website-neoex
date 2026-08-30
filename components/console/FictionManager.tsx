/**
 * components/console/FictionManager.tsx — Full Editor · FICTION source pane
 * ─────────────────────────────────────────────────────────────────────────────
 * 'use client' — interactive: chapter tab navigation, body textarea, inline
 * chapter-title input, inline DRAFT ⇄ SETTLED state toggle.
 *
 * Contract: docs/design/atlas-console-full-editor.md §3 (FictionManager) +
 * per-kind FICTION source pane. Bound EXACTLY to the prop interface:
 *
 *   interface FictionManagerProps {
 *     chapters:    FictionChapter[]
 *     setChapters: (chapters: FictionChapter[]) => void   // ARRAY, not updater fn
 *     active:      string | null                          // chapter.id
 *     setActive:   (id: string) => void
 *   }
 *
 * Layout (top → bottom):
 *   1. chapter selector strip — horizontal tabs (filled-ink active, NOT orange —
 *      drift-correction; prototype `.fic-tab.is-on` used orange). `+ CHAPTER`
 *      ghost button appended.
 *   2. inline chapter title input — `.ed-chapter-title` mono 11px, no chrome
 *      (drift-correction; prototype used Cormorant-italic 18px — that is the
 *      PREVIEW title register, not the editor input).
 *   3. body textarea — same `.ed-src`-style class as the article source textarea.
 *   4. inline DRAFT/SETTLED toggle — mirrors the outline-rail //STATE switch;
 *      filled-ink active (drift-correction; prototype used orange fill).
 *
 * SCHEMA-NEEDS (Procyon): FictionChapter / FictionMeta have no confirmed content
 * schema. This component uses in-component state only (chapters flow via props);
 * MOCK_FICTION_CHAPTERS / MOCK_FICTION_META below seed the integrator. Do NOT
 * wire to the velite content layer until Procyon confirms the fields.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor (FICTION unit)
 * Prototype: editor-kinds.jsx FictionManager@197 (REFERENCE — drift-corrected)
 */

'use client'

import type React from 'react'
import { useId } from 'react'
import type { FictionChapter, FictionMeta, FictionState } from './editor-types'

// ─────────────────────────────────────────────────────────────────────────────
// MOCK data — elegant placeholder for the integrator (SCHEMA-NEEDS: Procyon)
// Mapped from prototype FICTION_ENTRY (editor-kinds.jsx@29): md→body, +state.
// Exported so the editor shell can seed state, mirroring SAMPLE_DRAFT precedent.
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_FICTION_META: FictionMeta = {
  fileNum: '047',
  title:   'nebulosae',
  date:    '2026-05-14',
  tags:    ['fiction', 'possibility'],
}

export const MOCK_FICTION_CHAPTERS: FictionChapter[] = [
  {
    id:    'c1',
    title: 'I · the survey begins',
    state: 'settled',
    body:
      'she had measured everything except the thing that mattered.\n\n' +
      'the instrument *hummed*, indifferent to what it was pointed at — a habit ' +
      'of attention she had built so carefully it now ran without her.\n\n' +
      '> you cannot survey grief. you can only note where it holds.',
  },
  {
    id:    'c2',
    title: 'II · drift',
    state: 'draft',
    body:
      'the readings drifted that night, the way they always did when she stopped ' +
      'pretending to sleep.\n\n' +
      'each number a little **wrong**, each wrongness a little true.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Scoped component CSS — `.ficm-*` prefix (NOT `.fp-*`: that prefix is FullPreview's
// in the prototype and would collide). All values reference globals.css tokens.
//
// TOKEN-GAP for Betelgeuse:
//   - rgba(212,96,42,0.02) textarea focus tint (globals has --accent-orange-soft 0.18 only)
//   - 44px min touch target (a11y floor, no token)
// ─────────────────────────────────────────────────────────────────────────────

const FICM_CSS = `
.ficm {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  border-right: 1px dashed var(--ink-dashed);
  background: var(--paper-base);
}

/* ── chapter selector strip ─────────────────────────────────────────── */
.ficm-tabs {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ink-hairline);
}
.ficm-tablist {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ficm-tab {
  appearance: none;
  background: transparent;
  border: 1px solid var(--ink-hairline);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ink-soft);
  padding: 6px 10px;
  min-height: 32px;
  cursor: pointer;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
/* filled active — semantic token prevents glare in dark mode */
.ficm-tab.is-on {
  background: var(--btn-fill);
  border-color: var(--btn-fill);
  color: var(--btn-fill-fg);
}
.ficm-tab:hover:not(.is-on),
.ficm-tab:focus-visible:not(.is-on) {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  outline: none;
}
.ficm-tab:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.ficm-tab-state {
  font-size: 7px;
  letter-spacing: 0.18em;
}
.ficm-add {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ink-faint);
  padding: 6px 10px;
  min-height: 32px;
  cursor: pointer;
  text-transform: uppercase;
  transition: border-color 120ms ease, color 120ms ease;
}
.ficm-add:hover, .ficm-add:focus-visible {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  outline: none;
}

/* ── inline chapter title input ─────────────────────────────────────── */
/* drift-correction: mono 11px no-chrome (prototype used Cormorant italic 18px,
   which is the PREVIEW title register — not the editor input) */
.ficm-chaptitle {
  flex-shrink: 0;
  border: none;
  border-bottom: 1px solid var(--ink-hairline);
  background: transparent;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--ink-primary);
  padding: 11px 14px;
  outline: none;
}
.ficm-chaptitle:focus {
  border-color: var(--accent-orange);
}
.ficm-chaptitle::placeholder {
  color: var(--ink-faint);
}

/* ── body textarea — mirrors .ed-src / .src-text register ───────────── */
.ficm-body {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.9;
  letter-spacing: 0.01em;
  color: var(--ink-primary);
  padding: 12px 14px;
  min-height: 0;
  overflow-y: auto;
}
.ficm-body:focus {
  background: rgba(212,96,42,0.02); /* TOKEN-GAP: 0.02 accent tint */
}

/* ── inline DRAFT ⇄ SETTLED toggle (mirrors outline-rail //STATE) ────── */
.ficm-statebar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 9px 14px;
  border-top: 1px dashed var(--ink-dashed);
}
.ficm-state-lbl {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-right: 12px;
}
.ficm-switch {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ink-hairline);
}
.ficm-state {
  appearance: none;
  background: transparent;
  border: none;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  /* //STATE spec: inactive = ink-faint (active filled-ink below) */
  color: var(--ink-faint);
  padding: 7px 13px;
  min-height: 32px;
  cursor: pointer;
  text-transform: uppercase;
  transition: background 120ms ease, color 120ms ease;
}
/* filled active — semantic token prevents glare in dark mode */
.ficm-state.is-on {
  background: var(--btn-fill);
  color: var(--btn-fill-fg);
}
.ficm-state:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.ficm-switch-glyph {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-faint);
  padding: 0 6px;
  user-select: none;
}

/* ── empty state — centered + CHAPTER prompt ────────────────────────── */
.ficm-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 40px;
  text-align: center;
}
.ficm-empty-copy {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 13px;
  color: var(--ink-soft);
}
.ficm-empty-btn {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--ink-dashed);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--ink-soft);
  padding: 10px 16px;
  min-height: 44px;
  cursor: pointer;
  text-transform: uppercase;
  transition: border-color 120ms ease, color 120ms ease;
}
.ficm-empty-btn:hover, .ficm-empty-btn:focus-visible {
  border-color: var(--accent-orange);
  color: var(--accent-orange);
  outline: none;
}

@media (max-width: 600px) {
  /* a11y: ensure interactive elements clear the 44px touch floor */
  .ficm-tab, .ficm-add, .ficm-state { min-height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  .ficm-tab, .ficm-add, .ficm-state, .ficm-empty-btn { transition: none; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Props — bound EXACTLY to contract §3 (4 props; setChapters takes an ARRAY)
// ─────────────────────────────────────────────────────────────────────────────

export interface FictionManagerProps {
  chapters:    FictionChapter[]
  setChapters: (chapters: FictionChapter[]) => void
  active:      string | null
  setActive:   (id: string) => void
}

// Roman numerals for new-chapter titles (matches prototype convention)
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

// ─────────────────────────────────────────────────────────────────────────────
// FictionManager
// ─────────────────────────────────────────────────────────────────────────────

export function FictionManager({ chapters, setChapters, active, setActive }: FictionManagerProps) {
  const titleId = useId()

  // Resolve the active chapter; default to chapters[0] when active is missing.
  const ch = chapters.find(c => c.id === active) ?? chapters[0] ?? null

  // setChapters takes an ARRAY (not a functional updater) — build the next array
  // from the `chapters` prop on every mutation.
  const updateActive = (patch: Partial<FictionChapter>) => {
    if (!ch) return
    setChapters(chapters.map(c => (c.id === ch.id ? { ...c, ...patch } : c)))
  }

  const addChapter = () => {
    const n = chapters.length + 1
    const roman = ROMAN[n - 1] ?? String(n)
    const id = 'c' + Date.now().toString(36)
    setChapters([...chapters, { id, title: `${roman} · untitled`, body: '', state: 'draft' }])
    setActive(id)
  }

  // Roving arrow-key navigation across chapter tabs (contract keyboard map).
  // Left/Up → previous chapter, Right/Down → next; Home/End → first/last.
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ch) return
    const cur = chapters.findIndex(c => c.id === ch.id)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % chapters.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + chapters.length) % chapters.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = chapters.length - 1
    if (next >= 0 && next !== cur) {
      e.preventDefault()
      setActive(chapters[next].id)
    }
  }

  // Empty state — centered + CHAPTER prompt
  if (chapters.length === 0 || !ch) {
    return (
      <>
        <style>{FICM_CSS}</style>
        <div className="ficm">
          <div className="ficm-empty">
            <span className="ficm-empty-copy">no chapters yet</span>
            <button type="button" className="ficm-empty-btn" onClick={addChapter}>
              + CHAPTER
            </button>
          </div>
        </div>
      </>
    )
  }

  const setState = (state: FictionState) => updateActive({ state })

  return (
    <>
      <style>{FICM_CSS}</style>

      <div className="ficm">
        {/* ── chapter selector strip ── */}
        {/* role="tablist" wraps ONLY the tabs; `+ CHAPTER` is a sibling so the
            tablist contains tabs exclusively (a11y). Arrow keys roving-navigate
            the chapter tabs (contract keyboard map). */}
        <div className="ficm-tabs">
          <div
            className="ficm-tablist"
            role="tablist"
            aria-label="Chapters"
            onKeyDown={onTabKeyDown}
          >
            {chapters.map((c, i) => {
              const on = c.id === ch.id
              // short label: leading roman/segment before the first " · "
              const short = c.title.split(' · ')[0] || String(i + 1)
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  tabIndex={on ? 0 : -1}
                  className={'ficm-tab' + (on ? ' is-on' : '')}
                  onClick={() => setActive(c.id)}
                >
                  {short}
                  <span className="ficm-tab-state" aria-hidden>
                    {c.state === 'settled' ? '●' : '○'}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="ficm-add"
            onClick={addChapter}
            aria-label="add chapter"
          >
            + CHAPTER
          </button>
        </div>

        {/* ── inline chapter title input (mono 11px, no chrome) ── */}
        <label htmlFor={titleId} className="sr-only">
          chapter title
        </label>
        <input
          id={titleId}
          className="ficm-chaptitle"
          value={ch.title}
          spellCheck={false}
          placeholder="chapter title…"
          onChange={e => updateActive({ title: e.target.value })}
        />

        {/* ── body textarea ── */}
        <textarea
          className="ficm-body"
          value={ch.body}
          spellCheck={false}
          placeholder="prose — markdown. *italic* for the voice…"
          onChange={e => updateActive({ body: e.target.value })}
          aria-label="chapter body — markdown source"
        />

        {/* ── inline DRAFT ⇄ SETTLED toggle (filled-ink active) ── */}
        <div className="ficm-statebar">
          <span className="ficm-state-lbl">{"// STATE"}</span>
          <div className="ficm-switch" role="group" aria-label="chapter state">
            <button
              type="button"
              className={'ficm-state' + (ch.state === 'draft' ? ' is-on' : '')}
              aria-pressed={ch.state === 'draft'}
              onClick={() => setState('draft')}
            >
              DRAFT
            </button>
            <span className="ficm-switch-glyph" aria-hidden>⇄</span>
            <button
              type="button"
              className={'ficm-state' + (ch.state === 'settled' ? ' is-on' : '')}
              aria-pressed={ch.state === 'settled'}
              onClick={() => setState('settled')}
            >
              SETTLED
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
