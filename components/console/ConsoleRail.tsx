/**
 * components/console/ConsoleRail.tsx — Left rail (filter, search, entry list, new)
 * ─────────────────────────────────────────────────────────────────────────────
 * Receives all state from ConsoleApp via props — no local state.
 * Renders the three-block sidebar: KIND FILTER → SEARCH → ENTRY LIST → + NEW.
 *
 * CSS atoms used (from app/globals.css):
 *   .paper-warm-surface, .section-rule-dashed, .atlas-strata-btn/.is-active,
 *   .af-pill/.is-active (scoped via .console-rail wrapper, not .archive-filters)
 *
 * Note on .af-pill: the rail filter pills now compose from the MASTER .af-pill
 * base atom in globals.css (filled-ink is-active). The local .console-rail-pills
 * scope keeps ONLY rail-specific geometry (denser font/tracking/padding) + the
 * focus ring — it no longer redeclares background/color/border or an is-active
 * override. This resolves the af-pill MAJOR (audit #1: the prior orange-outline
 * scoped override shadowed the master atom). Inactive = ink-soft border/text,
 * hover = orange, active = filled ink-primary bg + paper-base text (from base).
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 2
 * Modeled after: console-rail.jsx LeftRail function (lines 13–88)
 * Prototype CSS: Worldline Console.html .rail-* + .console-rail (lines 38–65)
 */

'use client'

import type { ReactNode } from 'react'
import type { ConsoleNode, NodeKind } from './console-types'
import { KINDS } from './console-types'

// ─────────────────────────────────────────────────────────────────────────────
// CSS — inlined per project convention
// TOKEN-GAPs:
//   260px — console rail width (--console-rail-width)
//   TOKEN: .af-pill base shape inlined here (not in .archive-filters scope)
// ─────────────────────────────────────────────────────────────────────────────

const RAIL_CSS = `
/* ── console rail ───────────────────────────────────────────── */
.console-rail {
  border-right: 1px dashed var(--ink-dashed);
  display: flex; flex-direction: column; min-height: 0;
}
.rail-block { padding: 14px 16px; }
.rail-head {
  font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.32em;
  text-transform: uppercase; color: var(--ink-faint); margin-bottom: 11px;
  display: flex; justify-content: space-between; align-items: baseline;
}
.rail-count {
  color: var(--ink-soft); font-family: var(--font-type); letter-spacing: 0.04em;
}

/* kind filter pills — compose from the master .af-pill base atom (globals.css).
   af-pill MAJOR correction (audit #1): the local scope previously redeclared the
   FULL pill (background/color/border + an orange-outline is-active override),
   which shadowed the base atom and broke anchor-to-master. The base .af-pill /
   .af-pill:hover / .af-pill.is-active now own EVERY color state (filled-ink
   active). This local block keeps ONLY the rail-specific geometry (denser font /
   tracking / padding) + the focus ring — no color, no border, no is-active.
   Dropping the local background/color/border is load-bearing: leaving them at
   the same specificity as base .af-pill.is-active (0,2,0) would cancel the fill
   via source-order, rendering the active pill transparent instead of filled-ink. */
.console-rail-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.console-rail-pills .af-pill {
  font-size: 9px; letter-spacing: 0.12em; padding: 0.5em 0.7em;
}
.console-rail-pills .af-pill:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }

/* search row */
.rail-sep { margin: 0 16px; }
.rail-search {
  display: flex; align-items: center; gap: 8px;
  border: 1px solid var(--ink-hairline); background: var(--paper-base);
  padding: 8px 9px; transition: border-color 0.2s;
}
.rail-search:focus-within { border-color: var(--accent-orange); }
.rail-search-glyph { font-family: var(--font-mono); font-size: 12px; color: var(--ink-soft); }
.rail-search-input {
  flex: 1; min-width: 0; border: none; background: transparent; outline: none;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.05em; color: var(--ink-primary);
}
.rail-search-input::placeholder { color: var(--ink-faint); }
.rail-search-clear {
  appearance: none; background: none; border: none; color: var(--ink-soft);
  font-size: 15px; line-height: 1; cursor: pointer; padding: 0 2px;
  transition: color 0.15s;
}
.rail-search-clear:hover { color: var(--accent-orange); }
.rail-search-clear:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }

/* entry list */
.rail-list-block { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.rail-list {
  flex: 1; overflow-y: auto; margin: 0; padding: 0 0 4px;
  display: flex; flex-direction: column; gap: 5px; list-style: none;
}
.rail-list::-webkit-scrollbar { width: 6px; }
.rail-list::-webkit-scrollbar-thumb { background: var(--ink-faint); }
/* atlas-strata-btn overrides for rail context */
.console-rail .atlas-strata-btn {
  grid-template-columns: 20px 1fr auto; padding: 8px 10px; gap: 8px; width: 100%;
}
.console-rail .atlas-strata-btn .glyph {
  width: 20px; font-family: var(--font-mono); font-size: 13px;
}
.console-rail .atlas-strata-btn .label-id {
  text-transform: none; font-size: 9.5px; letter-spacing: 0.03em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;
}
/* D1 fix: pull .key back into grid flow for long fileIds (photo paths, fiction slugs)
   The base atom positions .key as absolute (globals.css:1088-1096) which breaks the
   20px 1fr auto grid — the auto column is never occupied and long ids overlay the title.
   This scoped override re-enables truncation without touching globals.css.
   TOKEN-GAP: 80px max-width is a literal (no token for badge max-width). */
.console-rail .atlas-strata-btn .key {
  position: static;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* scroll wrapper — flex:1 child carrying everything between the pinned CONSOLE
   header (ConsoleApp's <header>) and the pinned footer. Moved inline from
   globals.css (was Betelgeuse's stub; CSS Contract 9 requires console rules here).
   Standard scrollbar: thin with ink-faint thumb, soft on hover. */
.console-rail-scroll {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: var(--ink-soft) transparent;
}
.console-rail-scroll::-webkit-scrollbar { width: 4px; }
.console-rail-scroll::-webkit-scrollbar-track { background: transparent; }
.console-rail-scroll::-webkit-scrollbar-thumb { background-color: var(--ink-faint); border-radius: 2px; }
.console-rail-scroll::-webkit-scrollbar-thumb:hover { background-color: var(--ink-soft); }

/* rail footer */
.rail-foot { padding: 14px 16px; border-top: 1px dashed var(--ink-dashed); }
.rail-new {
  width: 100%; appearance: none; background: transparent;
  border: 1px solid var(--ink-hairline); color: var(--ink-primary);
  font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.22em;
  text-transform: uppercase; padding: 12px; cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.rail-new:hover {
  border-color: var(--accent-orange); color: var(--accent-orange);
  background: rgba(212,96,42,0.04); /* TOKEN-GAP: --accent-orange-faint */
}
.rail-new:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .console-rail-pills .af-pill,
  .rail-search,
  .rail-search-clear,
  .rail-new { transition-duration: 0.001ms; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Kind filter config — mirrors console-rail.jsx KIND_FILTERS
// ─────────────────────────────────────────────────────────────────────────────

const KIND_FILTERS: Array<{ id: 'all' | NodeKind; label: string }> = [
  { id: 'all',     label: 'ALL' },
  { id: 'article', label: 'ARTICLE' },
  { id: 'photo',   label: 'PHOTO' },
  { id: 'fiction', label: 'FICTION' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ConsoleRailProps {
  nodes:        ConsoleNode[]
  selectedId:   string | null
  activeFilter: 'all' | NodeKind
  query:        string
  onFilter:     (f: 'all' | NodeKind) => void
  onQuery:      (q: string) => void
  onSelect:     (id: string) => void
  onNew:        () => void
  /** Optional PLACES block injected above the filter — avoids splitting ConsoleRail further. */
  placesBlock?: ReactNode
}

// ─────────────────────────────────────────────────────────────────────────────
// ConsoleRail
// ─────────────────────────────────────────────────────────────────────────────

export function ConsoleRail({
  nodes, selectedId, activeFilter, query,
  onFilter, onQuery, onSelect, onNew,
  placesBlock,
}: ConsoleRailProps) {
  // ── Filter: mirror ConsoleCanvas.matchesQuery exactly so rail and canvas agree ──
  // KIND: keep when filter is 'all' or node.kind matches
  // QUERY: keep when no query, or [title, fileId, domain, ...tags].join(' ') includes it
  const filteredNodes = nodes.filter((n) => {
    const kindMatch = activeFilter === 'all' || n.kind === activeFilter
    if (!kindMatch) return false
    if (!query) return true
    return [n.title, n.fileId, n.domain, ...n.tags].join(' ').toLowerCase().includes(query.toLowerCase())
  })
  const count = String(filteredNodes.length).padStart(3, '0')

  return (
    <>
      <style>{RAIL_CSS}</style>
      <aside className="console-rail paper-warm-surface" aria-label="Authoring controls">

        {/* ── scroll wrapper: flex:1 child that carries everything between the
            pinned CONSOLE header (ConsoleApp's <header>) and the pinned footer.
            .console-rail-scroll lives in RAIL_CSS above (inline per Contract 9). ── */}
        <div className="console-rail-scroll">

          {/* 0. PLACES block — above filter (spec §5.1 preferred position) */}
          {placesBlock && (
            <>
              {placesBlock}
              <div className="section-rule-dashed rail-sep" />
            </>
          )}

          {/* 1. KIND FILTER */}
          {/* role="group" dropped: role="radiogroup" on the pill container carries the implicit group role */}
          <div className="rail-block" aria-label="Filter by kind">
            <div className="rail-head">{'// FILTER · KIND'}</div>
            <div className="console-rail-pills" role="radiogroup" aria-label="Filter by kind">
              {KIND_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={activeFilter === f.id}
                  className={'af-pill' + (activeFilter === f.id ? ' is-active' : '')}
                  onClick={() => onFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="section-rule-dashed rail-sep" />

          {/* 2. SEARCH */}
          <div className="rail-block">
            <div className="rail-search">
              <span className="rail-search-glyph" aria-hidden="true">⌕</span>
              <input
                type="text"
                className="rail-search-input"
                placeholder="search traces…"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                aria-label="Search the graph"
              />
              {query && (
                <button
                  type="button"
                  className="rail-search-clear"
                  onClick={() => onQuery('')}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="section-rule-dashed rail-sep" />

          {/* 3. ENTRY LIST */}
          <div className="rail-block rail-list-block">
            <div className="rail-head">
              {'// ENTRIES'} <span className="rail-count">{count}</span>
            </div>
            <ul className="rail-list" role="listbox" aria-label="Entries">
              {filteredNodes.length === 0 ? (
                /* empty-state: instrument-idiom, ink-faint, no visual noise */
                <li
                  role="option"
                  aria-selected={false}
                  aria-disabled="true"
                  style={{ listStyle: 'none', padding: '8px 10px' }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      letterSpacing: '0.14em',
                      color: 'var(--ink-faint)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {'// no entries'}
                  </span>
                </li>
              ) : (
                filteredNodes.map((n) => {
                  const k = KINDS[n.kind]
                  const sel = selectedId === n.id
                  return (
                    <li key={n.id} role="option" aria-selected={sel} style={{ listStyle: 'none' }}>
                      <button
                        type="button"
                        className={'atlas-strata-btn' + (sel ? ' is-active' : '')}
                        onClick={() => onSelect(n.id)}
                      >
                        <span
                          className="glyph"
                          style={{ color: sel ? 'var(--accent-orange)' : k.color }}
                        >
                          {k.glyph}
                        </span>
                        <span>
                          <span className="label-id">{n.title}</span>
                          <span className="label-role">{n.kind} · {n.domain}</span>
                        </span>
                        {/* title preserves full fileId when truncated by D1 fix */}
                        <span className="key" title={n.fileId}>{n.fileId}</span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>

        </div>{/* /console-rail-scroll */}

        {/* 4. NEW ENTRY — pinned footer, outside scroll wrapper */}
        <div className="rail-foot">
          <button type="button" className="rail-new" onClick={onNew}>
            + &nbsp;NEW ENTRY
          </button>
        </div>

      </aside>
    </>
  )
}
