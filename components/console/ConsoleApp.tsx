/**
 * components/console/ConsoleApp.tsx — Atlas Console shell
 * ─────────────────────────────────────────────────────────────────────────────
 * 'use client' — manages all console state: nodes, edges, selection, hover,
 * kind filter, search query, form open/mode/data, dirty, saving.
 *
 * Receives `initialNodes` from the Server Component (app/console/page.tsx),
 * which fetches real velite entries. No client-side data fetch (quality bar rule).
 *
 * Layout: two-pane instrument.
 *   grid-template-columns: 260px minmax(0, 1fr)
 *   left rail fixed 260px (TOKEN-GAP: --console-rail-width)
 *   canvas fills remainder
 *   Full height: 100vh, overflow: hidden
 *
 * Navigation round-trip (spec §console↔editor):
 *   console node → OPEN EDITOR ⟶ → /console/editor?kind=<kind>&slug=<fileId>
 *   editor ⟵ CONSOLE → /console (this route — the link in ArticleEditor.tsx already wired)
 *
 * ESC behavior (per spec):
 *   - form open → close form (deselect stays, so node is still highlighted)
 *   - no form → deselect node
 *   CMD/CTRL+S when form open → save draft (mocked)
 *
 * Narrow viewport (< 600px): offline state per spec (no mobile support).
 * Uses CSS media query via matchMedia in effect — never reads window on initial render.
 *
 * TOKEN-GAPS reported here (use literals; Betelgeuse proposes before Slice 3):
 *   260px — console rail width (--console-rail-width)
 *   54px  — console header height (--console-header-height)
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 2
 * Modeled after: console-app.jsx ConsoleApp + Root functions (lines 14–211)
 * Prototype CSS: Worldline Console.html .console-shell, .console-header,
 *   .ch-*, .console-body, .console-foot, .console-offline (lines 17–154)
 */

'use client'

import { useState, useEffect, useCallback, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ConsoleNode, ConsoleEdge, ConsoleFormData, NodeKind, PlaceDTO } from './console-types'
import { KINDS } from './console-types'
import { ConsoleRail }           from './ConsoleRail'
import { ConsoleCanvas }         from './ConsoleCanvas'
import { ConsoleEntryForm }      from './ConsoleEntryForm'
import { PlacesRailBlock }       from './PlacesRailBlock'
import { PlaceHighlightEditor }  from './PlaceHighlightEditor'
// S6: import real store actions (createEntry replaces the mocked persist in new-entry flow)
// movable-alpha: setAlphaPlace is the α locus assignment action (migration 0009b)
import { createEntry, setAlphaPlace } from '@/lib/server/store/actions'
// simple-upload: frictionless photo drop zone on the console front door
import { QuickUploadBar } from './QuickUploadBar'

// ─────────────────────────────────────────────────────────────────────────────
// CSS — shell, header, body grid, NETRA foot, offline
// TOKEN-GAPs marked inline
// ─────────────────────────────────────────────────────────────────────────────

const CONSOLE_CSS = `
/* ── shell ───────────────────────────────────────────────────── */
.console-shell {
  height: 100vh; display: flex; flex-direction: column;
  background: var(--paper-base); overflow: hidden;
}

/* ── header strip ────────────────────────────────────────────── */
.console-header {
  position: relative; flex-shrink: 0;
  height: 54px; /* TOKEN-GAP: --console-header-height */
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  padding: 0 24px; border-bottom: 1px dashed var(--ink-dashed); background: var(--paper-base);
}
.console-header .corner-marks { inset: 9px; }
.ch-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
.ch-dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--accent-orange);
  box-shadow: 0 0 0 3px var(--accent-orange-soft); flex-shrink: 0;
}
.ch-title {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--ink-primary); white-space: nowrap;
}
.ch-dev {
  font-family: var(--font-mono); font-size: 7.5px; letter-spacing: 0.2em;
  color: var(--accent-orange); border: 1px solid rgba(212,96,42,0.4);
  padding: 2px 5px; white-space: nowrap;
}
.ch-center {
  font-family: var(--font-display); font-style: italic;
  font-size: 13px; color: var(--ink-soft); text-align: center; white-space: nowrap;
}
.ch-exit {
  justify-self: end; appearance: none; background: none; border: none;
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--ink-soft); cursor: pointer; padding: 6px;
  transition: color 0.15s;
}
.ch-exit:hover { color: var(--accent-orange); }
.ch-exit:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }

/* ── body — two pane ─────────────────────────────────────────── */
.console-body {
  flex: 1; display: grid;
  grid-template-columns: 260px minmax(0, 1fr); /* TOKEN-GAP: --console-rail-width */
  min-height: 0;
}

/* ── NETRA voice strip foot ──────────────────────────────────── */
.console-foot {
  flex-shrink: 0; border-top: 1px dashed var(--ink-dashed); background: var(--paper-base);
}
.console-foot .atlas-netra-voice {
  border-left-width: 3px; padding: 9px 16px 10px;
}

/* ── offline — narrow viewport ───────────────────────────────── */
.console-offline {
  height: 100vh; position: relative; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px; text-align: center; padding: 24px;
}
.offline-msg {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--accent-orange); position: relative; z-index: 3;
}
.offline-sub {
  font-family: var(--font-display); font-style: italic;
  font-size: 15px; color: var(--ink-soft); max-width: 34ch; position: relative; z-index: 3;
}

@media (prefers-reduced-motion: reduce) {
  .ch-exit { transition-duration: 0.001ms; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// uid counter for new node ids — in handler scope only, never in render
// ─────────────────────────────────────────────────────────────────────────────

let _uid = 100
const nextId = () => 'n' + (++_uid)

// ─────────────────────────────────────────────────────────────────────────────
// ConsoleApp
// ─────────────────────────────────────────────────────────────────────────────

interface ConsoleAppProps {
  initialNodes:  ConsoleNode[]
  initialEdges:  ConsoleEdge[]
  initialPlaces: PlaceDTO[]
}

export function ConsoleApp({ initialNodes, initialEdges, initialPlaces }: ConsoleAppProps) {
  const router = useRouter()
  // S6: useTransition wraps createEntry so saving state is SSR-safe
  const [_createPending, startCreateTransition] = useTransition()

  // ── Core graph state ──
  const [nodes,      setNodes]     = useState<ConsoleNode[]>(initialNodes)
  const [edges,      setEdges]     = useState<ConsoleEdge[]>(initialEdges)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId,  setHoveredId]  = useState<string | null>(null)

  // ── Places state ──
  // Held in React state; seeded from server. Updated from action return values only
  // (decoupled-state contract — no velite refetch, no router.refresh for immediate panel).
  const [places,           setPlaces]           = useState<PlaceDTO[]>(initialPlaces)
  const [placeEditorOpen,  setPlaceEditorOpen]  = useState(false)
  const [editingPlaceId,   setEditingPlaceId]   = useState<string | null>(null)  // null = new place
  // Nonce: bumped on each open so the PlaceHighlightEditor key changes → component remounts →
  // useState initializers re-run → working state reseeds from the current place DTO.
  // This is load-bearing: without it, closing+reopening the same place retains unsaved edits.
  const [editorNonce, setEditorNonce] = useState(0)
  // movable-alpha: true while the setAlphaPlace action is in flight
  const [alphaChanging, setAlphaChanging] = useState(false)

  // The PlaceDTO currently being edited (derived — no useEffect for derived state)
  const editingPlace = editingPlaceId
    ? (places.find((p) => p.id === editingPlaceId) ?? null)
    : null

  // ── Filter + search ──
  const [activeFilter, setActiveFilter] = useState<'all' | NodeKind>('all')
  const [query,        setQuery]         = useState('')
  const [flyTarget,    setFlyTarget]     = useState<string | null>(null)

  // ── Entry form ──
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'new' | 'edit'>('edit')
  const [formData, setFormData] = useState<ConsoleFormData | null>(null)
  const [dirty,    setDirty]   = useState(false)
  const [saving,   setSaving]  = useState(false)

  // ── Narrow viewport — offline state ──
  // Read window.innerWidth in useEffect (hydration safety rule)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 600)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Post-delete: ?removed=<nodeId> ─────────────────────────────────────────
  // When EntryEditor deletes an entry it navigates to /console?removed=<nodeId>.
  // On mount, read the param, remove the node + its edges from state, then clean
  // the URL with replaceState so the param doesn't persist on refresh.
  //
  // Runs once on mount (empty dep array). The editor always navigates with a fresh
  // page load → ConsoleApp re-mounts → this effect fires exactly once per delete.
  // edges: also filter dangling edges to match the invariant the server build holds
  // (addEdge checks both endpoints exist; ConsoleCanvas may not expect orphaned edges).
  //
  // window.location.search is read in useEffect (hydration safety rule — not initial render).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const removedId = params.get('removed')
    if (!removedId) return
    // Remove the node and any edge that references it.
    setNodes((ns) => ns.filter((n) => n.id !== removedId))
    setEdges((es) => es.filter((e) => e.source !== removedId && e.target !== removedId))
    // Deselect if the removed node was selected.
    setSelectedId((id) => (id === removedId ? null : id))
    // Clean the URL — no reload, no history entry.
    const cleanUrl = window.location.pathname
    window.history.replaceState(null, '', cleanUrl)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally mount-only — fires once per navigation (ConsoleApp remounts)

  // ── Search-to-fly: first match drives the canvas pan ──
  useEffect(() => {
    if (!query) { setFlyTarget(null); return }
    const q = query.toLowerCase()
    const first = nodes.find((n) =>
      [n.title, n.fileId, n.domain, ...n.tags].join(' ').toLowerCase().includes(q)
    )
    // FIX(gap#1/#4): use Date.now() suffix so the key changes on every
    // keystroke even when the matched node is the same. This is inside a
    // useEffect (post-hydration, client-only) — not a render expression —
    // so it does not violate hydration purity. The full key is passed to
    // ConsoleCanvas; the canvas splits ':' to get the bare node id for
    // the lookup, and the changing suffix makes the effect dep re-fire.
    if (first) setFlyTarget(first.id + ':' + Date.now())
    else setFlyTarget(null)
  }, [query, nodes])

  // ── Selection opens the edit form ──
  const openEdit = useCallback((id: string) => {
    const n = nodes.find((x) => x.id === id)
    if (!n) return
    setSelectedId(id)
    setFormMode('edit')
    setFormData({ ...n, tags: [...n.tags] })
    setFormOpen(true)
    setDirty(false)
  }, [nodes])

  const openNew = useCallback(() => {
    setSelectedId(null)
    setFormMode('new')
    setFormData({ id: '', kind: 'article', fileId: '', title: '', date: '', domain: '', tags: [], summary: '', x: 240, y: 180 })
    setFormOpen(true)
    setDirty(false)
  }, [])

  const closeForm = useCallback(() => { setFormOpen(false); setDirty(false) }, [])

  const onField = useCallback((key: keyof ConsoleFormData, val: string | string[] | NodeKind) => {
    setFormData((d) => d ? { ...d, [key]: val } : d)
    setDirty(true)
  }, [])

  // ── Persist — S6: new-entry calls createEntry; edit still optimistically updates ──
  // Spec §8 pt2: on createEntry ok → router.push to the editor.
  // Edit path (formMode='edit') is only called by ConsoleEntryForm SAVE DRAFT, which
  // is a legacy canvas-position / tag update — not the full updateEntry body edit.
  // The real body editing lives in EntryEditor. We keep the edit path as-is (graph
  // metadata only — no body) and only replace the new-entry path.
  const persist = useCallback((commit: boolean) => {
    if (formMode === 'new' && formData) {
      // S6: real createEntry — minimal draft (DL14)
      setSaving(true)
      startCreateTransition(async () => {
        const result = await createEntry({
          kind:    formData.kind === 'repo' ? 'article' : formData.kind,  // 'repo' not a DB kind
          title:   formData.title || undefined,
          date:    formData.date || undefined,
          domain:  formData.domain || undefined,
          tags:    formData.tags,
          summary: formData.summary || undefined,
        })
        setSaving(false)
        if (!result.ok) {
          // Surface error in dirty flag area (simple string for now)
          setDirty(false)
          // Re-open the form with error note — keep the form data intact
          // The error will appear on the next onField touch; setDirty signal
          // the form still has work. We could show error more richly but
          // spec§8 just says "on ok → push"; no error UI spec — show in console.
          console.error('[ConsoleApp] createEntry failed:', result.error)
          return
        }
        const { kind, slug } = result.entry
        // Navigate to the editor — same URL contract as the canvas node OPEN EDITOR link
        router.push(`/console/editor?kind=${encodeURIComponent(kind)}&slug=${encodeURIComponent(slug)}`)
        if (commit) setFormOpen(false)
      })
    } else {
      // Edit path — optimistic update (canvas position / metadata only; body lives in EntryEditor)
      setSaving(true)
      setTimeout(() => {
        if (formData) {
          setNodes((ns) => ns.map((n) => n.id === formData.id ? { ...n, ...formData } : n))
        }
        setSaving(false)
        setDirty(false)
        if (commit) setFormOpen(false)
      }, 240)
    }
  }, [formMode, formData, router, startCreateTransition])

  // ── Node move ──
  const moveNode = useCallback((id: string, x: number, y: number) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, x, y } : n))
  }, [])

  // ── Edge creation ──
  const createEdge = useCallback((source: string, target: string) => {
    if (edges.some((e) =>
      (e.source === source && e.target === target) ||
      (e.source === target && e.target === source)
    )) return
    setEdges((es) => [...es, { id: 'e' + Date.now(), source, target, label: '' }])
  }, [edges])

  // ── Node select (canvas and rail share this via openEdit) ──
  const selectNode = useCallback((id: string | null) => {
    if (id == null) { setSelectedId(null) } else { openEdit(id) }
  }, [openEdit])

  // ── Places handlers ──
  const openPlaceEditor = useCallback((placeId: string) => {
    setEditingPlaceId(placeId)
    setPlaceEditorOpen(true)
    // Bump nonce so the PlaceHighlightEditor key changes → remount → useState
    // initializers re-run → working state reseeds. Load-bearing for reopen after close.
    setEditorNonce((n) => n + 1)
    // Close entry form when switching to place editor (mutually exclusive panels)
    setFormOpen(false)
  }, [])

  const openNewPlace = useCallback(() => {
    setEditingPlaceId(null)
    setPlaceEditorOpen(true)
    // Same nonce bump — ensures new-place form reseeds cleanly on each open.
    setEditorNonce((n) => n + 1)
    setFormOpen(false)
  }, [])

  const closePlaceEditor = useCallback(() => {
    setPlaceEditorOpen(false)
  }, [])

  // Called by PlaceHighlightEditor after a successful savePlaceHighlights / savePlaceCoord.
  // Updates the rail card's highlight state + coord from the ACTION RETURN VALUE only.
  const onPlaceSaved = useCallback((placeId: string, updated: Partial<PlaceDTO>) => {
    setPlaces((ps) =>
      ps.map((p) => p.id === placeId ? { ...p, ...updated } : p)
    )
  }, [])

  // Called after createPlace — appends the new place to rail state.
  // NOTE: intentionally does NOT call setEditingPlaceId(newPlace.id). Switching the id
  // would change the key → component remounts → status message "place created…" is lost.
  // The editor stays in new-place mode; the new card appears in the rail immediately.
  const onPlaceCreated = useCallback((newPlace: PlaceDTO) => {
    setPlaces((ps) => [...ps, newPlace])
  }, [])

  // movable-alpha: designate a place as the alpha locus.
  // Calls setAlphaPlace (server action → set_alpha_place SQL + revalidatePath).
  // Updates local state optimistically so the rail reflects immediately.
  const handleSetAlpha = useCallback(async (placeId: string) => {
    setAlphaChanging(true)
    const result = await setAlphaPlace({ placeId })
    setAlphaChanging(false)
    if (!result.ok) {
      // Non-fatal: log and leave UI unchanged (DB remains the source of truth on next load)
      console.error('[ConsoleApp] setAlphaPlace failed:', result.error)
      return
    }
    // Flip isAlpha flags: exactly one place is alpha at any time.
    setPlaces((ps) =>
      ps.map((p) => ({ ...p, isAlpha: p.id === placeId }))
    )
  }, [])

  // ── Keyboard: ESC closes form / deselects; Cmd+S saves draft ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Mutually exclusive panels — close whichever is open
        if (placeEditorOpen) { closePlaceEditor(); return }
        if (formOpen) closeForm()
        else setSelectedId(null)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (formOpen) persist(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [formOpen, placeEditorOpen, persist, closeForm, closePlaceEditor])

  // ── NETRA narration — derived synchronously (no useEffect for derived state) ──
  const selected = nodes.find((n) => n.id === selectedId) ?? null

  const netra = useMemo<string>(() => {
    if (nodes.length === 0) return 'no entries in graph — add one below.'
    if (formMode === 'new' && formOpen) return 'drafting a new trace — assign a file id and survey it into the field.'
    if (selected) {
      const k = KINDS[selected.kind]
      const deg = edges.filter((e) => e.source === selected.id || e.target === selected.id).length
      return `${selected.kind} · ${selected.fileId} — "${selected.title}." ${k.role.toLowerCase()}, ${deg} worldline link${deg === 1 ? '' : 's'} in view.`
    }
    return 'standby · ne0ex aggregate in view. select a node to survey, or draw a link.'
  }, [nodes, edges, selected, formMode, formOpen])

  // ── Narrow viewport — offline screen ──
  if (narrow) {
    return (
      <>
        <style>{CONSOLE_CSS}</style>
        <div className="console-offline paper-canvas" role="alert">
          <div className="corner-marks" />
          <div className="offline-msg">INSTRUMENT OFFLINE · NARROW VIEWPORT</div>
          <div className="offline-sub">peat tends from desktop. the console does not fold to a phone.</div>
        </div>
      </>
    )
  }

  // ── Full console shell ──
  return (
    <>
      <style>{CONSOLE_CSS}</style>

      {/* Skip-to-content link (hidden until focused) */}
      <a
        href="#console-main"
        style={{
          position: 'absolute', top: '-40px', left: 0,
          padding: '4px 8px', background: 'var(--accent-orange)', color: 'var(--paper-bright)',
          fontFamily: 'var(--font-mono)', fontSize: '9px', zIndex: 100,
          textDecoration: 'none',
        }}
        onFocus={(e) => { (e.target as HTMLAnchorElement).style.top = '0' }}
        onBlur={(e)  => { (e.target as HTMLAnchorElement).style.top = '-40px' }}
      >
        skip to console
      </a>

      <main className="console-shell" role="application" aria-label="Worldline Console">

        {/* ── Header strip ── */}
        <header className="console-header">
          <div className="corner-marks" />
          <div className="ch-left">
            <span className="ch-dot" aria-hidden="true" />
            {/* S6: removed [ DEV ] badge — auth replaces dev-only guard (DL12/S4) */}
            <span className="ch-title">CONSOLE · WORLDLINE AUTHORING</span>
          </div>
          <div className="ch-center">∇ neospirit // worldline 1.130426</div>
          {/* ESC·EXIT: in browser deselects current node / closes form (spec §header) */}
          <button
            type="button"
            className="ch-exit"
            onClick={() => {
              if (formOpen) closeForm()
              else setSelectedId(null)
            }}
          >
            [ ESC · EXIT ]
          </button>
        </header>

        {/* ── Quick upload bar — simple-upload track.
            Peat drops photos here; they publish with zero further input.
            Lives between header and the two-pane body for maximum visibility. */}
        <QuickUploadBar />

        {/* ── Body — two-pane ── */}
        <div id="console-main" className="console-body" tabIndex={-1}>

          {/* Left rail — PLACES block above entry list */}
          <ConsoleRail
            nodes={nodes}
            selectedId={selectedId}
            activeFilter={activeFilter}
            query={query}
            onFilter={setActiveFilter}
            onQuery={setQuery}
            onSelect={openEdit}
            onNew={openNew}
            placesBlock={
              <PlacesRailBlock
                places={places}
                selectedPlaceId={editingPlaceId}
                onEditPlace={openPlaceEditor}
                onNewPlace={openNewPlace}
                onSetAlpha={handleSetAlpha}
                alphaChanging={alphaChanging}
              />
            }
          />

          {/* Canvas column */}
          <div className="console-canvas-col">
            <ConsoleCanvas
              nodes={nodes}
              edges={edges}
              selectedId={selectedId}
              hoveredId={hoveredId}
              activeFilter={activeFilter}
              query={query}
              flyTarget={flyTarget}
              onSelect={selectNode}
              onHover={setHoveredId}
              onMoveNode={moveNode}
              onCreateEdge={createEdge}
            />

            {/* NETRA voice strip */}
            <div className="console-foot">
              <div className="atlas-netra-voice" aria-live="polite">
                <span className="voice-tag">NETRA</span>
                <span className="voice-body">{netra}</span>
              </div>
            </div>

            {/* Entry form — slides up from canvas foot (mutually exclusive with place editor) */}
            <ConsoleEntryForm
              open={formOpen && !placeEditorOpen}
              mode={formMode}
              data={formData}
              dirty={dirty}
              saving={saving}
              onField={onField}
              onClose={closeForm}
              onSaveDraft={() => persist(false)}
              onCommit={() => persist(true)}
            />

            {/* Place highlight editor — slides up from canvas foot.
                key= ensures remount on place change + on each reopen (nonce) so
                useState initializers re-run, reseeding working state from current DTO.
                Avoids useEffect for derived state per Sirius quality bar. */}
            <PlaceHighlightEditor
              key={`${editingPlaceId ?? 'new'}-${editorNonce}`}
              open={placeEditorOpen}
              place={editingPlace}
              onClose={closePlaceEditor}
              onSaved={onPlaceSaved}
              onCreated={onPlaceCreated}
              onSetAlpha={handleSetAlpha}
              alphaChanging={alphaChanging}
            />
          </div>

        </div>
      </main>
    </>
  )
}
