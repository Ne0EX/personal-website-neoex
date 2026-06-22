/**
 * components/console/ConsoleCanvas.tsx — Custom node-graph canvas
 * ─────────────────────────────────────────────────────────────────────────────
 * Pan, drag, drag-to-link, auto-arrange, search-to-fly, node + edge rendering.
 * No react-flow dependency — custom pointer-capture hit testing.
 *
 * Pan mechanism: pointer-down on background → capture → translate world div.
 * Node drag: pointer-down on card → capture on card.
 * Drag-to-link: pointer-down on .kn-handle → ghost edge → release on target.
 * Auto-arrange: 3-column tidy grid, 400ms ease-in-out (class toggle).
 * Search-to-fly: rAF ease-in-out, 350ms. Respects prefers-reduced-motion.
 *
 * α watermark: translates at 0.4× pan rate (parallax depth, synchronous, no CSS transition).
 *
 * CSS atoms used (from app/globals.css):
 *   .paper-canvas, .atlas-alpha-mark, .atlas-hud, .atlas-hud-corner
 *
 * TOKEN-GAPS (documented per spec §token gaps):
 *   rgb(var(--ink-rgb) / 0.22) — canvas-frame dashed border (--ink-canvas-frame)
 *   --hud-btn-bg resolved (light: cream tint, dark: paper-warm tint)
 *   158px — node card width (--node-w)
 *   70px — node card min-height (--node-h)
 *   280px — α watermark font-size (--alpha-mark-size)
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 2
 * Modeled after: console-canvas.jsx Canvas function (lines 11–251)
 * Prototype CSS: Worldline Console.html .canvas-*, .kn-*, .edge-*, .hud-* (lines 66–111)
 */

'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { ConsoleNode, ConsoleEdge, NodeKind } from './console-types'
import { KINDS } from './console-types'

// ─────────────────────────────────────────────────────────────────────────────
// Constants — TOKEN-GAPs per spec
// ─────────────────────────────────────────────────────────────────────────────

const NODE_W = 158  // TOKEN-GAP: --node-w
const NODE_H = 70   // TOKEN-GAP: --node-h

// ─────────────────────────────────────────────────────────────────────────────
// CSS — ported from prototype "Worldline Console.html" canvas block
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_CSS = `
/* ── canvas column ───────────────────────────────────────────── */
.console-canvas-col {
  position: relative; display: flex; flex-direction: column;
  min-width: 0; overflow: hidden;
}
.canvas-frame {
  flex: 1; position: relative; margin: 12px;
  border: 1px dashed rgb(var(--ink-rgb) / 0.22); /* TOKEN-GAP: --ink-canvas-frame */
  overflow: hidden; min-height: 0;
}
.canvas-viewport {
  position: absolute; inset: 0; overflow: hidden; touch-action: none;
}
/* A1: scale applied here — nodes/edges live inside this layer */
.canvas-world {
  position: absolute; inset: 0; pointer-events: none; z-index: 3;
  transform-origin: 0 0; /* zoom origin is top-left; offset via pan + mid math */
}
.canvas-edges {
  position: absolute; left: 0; top: 0; pointer-events: none; overflow: visible;
}
.canvas-empty {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-family: var(--font-display); font-style: italic;
  font-size: 16px; color: var(--ink-soft); z-index: 3; pointer-events: none;
}

/* α watermark — overrides the base 200px in globals.css to 280px per spec */
.canvas-viewport .atlas-alpha-mark { font-size: 280px; /* TOKEN-GAP: --alpha-mark-size */ }

/* ── kind-node card ──────────────────────────────────────────── */
.kn-card {
  position: absolute; pointer-events: auto; background: var(--paper-warm);
  border: 1px solid var(--ink-hairline); padding: 8px 9px; cursor: grab; user-select: none;
  display: flex; flex-direction: column; gap: 3px;
  transition: opacity 150ms ease, border-color 150ms ease, box-shadow 120ms ease;
}
.kn-card.is-arranging {
  transition: left 400ms ease-in-out, top 400ms ease-in-out, opacity 150ms ease, border-color 150ms ease;
}
.kn-card:active { cursor: grabbing; }
.kn-card.is-selected { border-color: var(--accent-orange); }
.kn-card.is-hover { border-color: rgba(212,96,42,0.5); }
.kn-row { display: flex; align-items: baseline; gap: 7px; }
.kn-glyph { font-family: var(--font-mono); font-size: 14px; line-height: 1; }
.kn-fileid { font-family: var(--font-type); font-size: 9px; letter-spacing: 0.04em; color: var(--ink-soft); }
.kn-title {
  font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.05em;
  color: var(--ink-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.kn-reticle {
  position: absolute; width: 8px; height: 8px;
  border: 1px solid var(--accent-orange); opacity: 0;
  transition: opacity 120ms ease-out; pointer-events: none;
}
.kn-reticle.tl { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.kn-reticle.br { bottom: -1px; right: -1px; border-left: none; border-top: none; }
.kn-card.is-hover .kn-reticle,
.kn-card.is-selected .kn-reticle { opacity: 1; }
.kn-handle {
  position: absolute; right: -3px; bottom: -3px; width: 8px; height: 8px;
  background: var(--ink-faint); opacity: 0; cursor: crosshair;
  transition: opacity 0.15s, background 0.15s;
}
.kn-card:hover .kn-handle { opacity: 1; }
.kn-handle:hover { background: var(--accent-orange); }

/* ── edge label ──────────────────────────────────────────────── */
.edge-label-wrap {
  width: 160px; height: 26px; display: flex; align-items: center;
  justify-content: center; pointer-events: none;
}
.edge-label {
  font-family: var(--font-display); font-style: italic; font-size: 11px;
  letter-spacing: 0.005em; color: var(--ink-soft);
  background: var(--paper-base); padding: 0 6px; white-space: nowrap;
  transition: color 100ms ease;
}
.edge-label[data-active="1"] { color: var(--ink-primary); }

/* ── HUD control cluster (BL) ────────────────────────────────── */
.canvas-hud-controls {
  position: absolute; left: 10px; bottom: 9px; z-index: 5;
  display: flex; align-items: center; gap: 8px;
}
.hud-readout {
  display: flex; gap: 12px; font-family: var(--font-mono);
  font-size: 7px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-soft);
}
.hud-readout b {
  font-family: var(--font-type); font-size: 9px;
  letter-spacing: 0.04em; color: var(--ink-primary); font-weight: 400;
}
.hud-btn {
  appearance: none;
  background: var(--hud-btn-bg);  /* light: cream paper-base tint; dark: paper-warm tint */
  border: 1px solid var(--ink-hairline); color: var(--ink-soft);
  font-family: var(--font-mono); font-size: 8px; letter-spacing: 0.18em;
  text-transform: uppercase; padding: 5px 9px; cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.hud-btn:hover { border-color: var(--accent-orange); color: var(--accent-orange); }
.hud-btn:focus-visible { outline: 1px dashed var(--accent-orange); outline-offset: 2px; }

/* A1: zoom readout — monospace scale percentage beside ARRANGE/ORIGIN */
.hud-zoom-readout {
  font-family: var(--font-mono);
  font-size: 7px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--ink-soft); white-space: nowrap;
}
.hud-zoom-readout b {
  font-family: var(--font-type); font-size: 9px;
  letter-spacing: 0.04em; color: var(--ink-primary); font-weight: 400;
}

@media (prefers-reduced-motion: reduce) {
  .kn-card { transition-duration: 0.001ms; }
  .kn-card.is-arranging { transition-duration: 0.001ms; }
  .kn-reticle { transition-duration: 0.001ms; }
  .kn-handle { transition-duration: 0.001ms; }
  .edge-label { transition-duration: 0.001ms; }
  .hud-btn { transition-duration: 0.001ms; }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function centerOf(n: ConsoleNode) {
  return { x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 }
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  // Straight edges — edgeCurve=false per prototype 6-round settled default
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ConsoleCanvasProps {
  nodes:        ConsoleNode[]
  edges:        ConsoleEdge[]
  selectedId:   string | null
  hoveredId:    string | null
  activeFilter: 'all' | NodeKind
  query:        string
  flyTarget:    string | null   // node id to fly to
  onSelect:     (id: string | null) => void
  onHover:      (id: string | null) => void
  onMoveNode:   (id: string, x: number, y: number) => void
  onCreateEdge: (source: string, target: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// ConsoleCanvas
// ─────────────────────────────────────────────────────────────────────────────

// ── Pinch-zoom constants ──
const SCALE_MIN = 0.3
const SCALE_MAX = 3.0

export function ConsoleCanvas({
  nodes, edges, selectedId, hoveredId, activeFilter, query,
  flyTarget, onSelect, onHover, onMoveNode, onCreateEdge,
}: ConsoleCanvasProps) {
  const vpRef  = useRef<HTMLDivElement>(null)
  const [pan,       setPan]       = useState({ x: 0, y: 0 })
  const [drag,      setDrag]      = useState<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)
  const [conn,      setConn]      = useState<{ source: string; x: number; y: number } | null>(null)
  const [panning,   setPanning]   = useState<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const [arranging, setArranging] = useState(false)

  // A1: pinch-zoom state — default 1, clamped [SCALE_MIN, SCALE_MAX]
  const [scale, setScale] = useState(1)
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  // A1: active pointer map for pinch detection (two-finger gesture needs both points)
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  // A1: pinch gesture baseline — recorded when the second pointer goes down
  const pinchRef = useRef<{
    startDist: number
    startScale: number
    startMid: { x: number; y: number }
    startPan: { x: number; y: number }
  } | null>(null)

  // Keep a ref for pan so pointer-move callbacks always see current value
  const panRef = useRef(pan)
  panRef.current = pan

  // ── Adjacency — 1-hop highlight ──
  const adj = useCallback((id: string): Set<string> => {
    const set = new Set<string>([id])
    edges.forEach((e) => {
      if (e.source === id) set.add(e.target)
      if (e.target === id) set.add(e.source)
    })
    return set
  }, [edges])

  const matchesQuery = useCallback((n: ConsoleNode): boolean => {
    if (!query) return false
    const q = query.toLowerCase()
    return [n.title, n.fileId, n.domain, ...n.tags].join(' ').toLowerCase().includes(q)
  }, [query])

  // ── Search-to-fly: pan first match to centre ──
  useEffect(() => {
    if (!flyTarget) return
    // flyTarget is "<nodeId>:<timestamp>" — split to get the bare id.
    // The timestamp suffix changes per keystroke so this effect re-fires
    // even when the same node remains the top match.
    const flyId = flyTarget.split(':')[0]
    const n = nodes.find((x) => x.id === flyId)
    const vp = vpRef.current
    if (!n || !vp) return
    const c = centerOf(n)
    // A1: scale-aware fly-to. The world → screen mapping is:
    //   screen = pan + world * scale
    // To centre a world point c on the viewport:
    //   pan = vpCentre - c * scale
    const s = scaleRef.current
    const target = {
      x: vp.clientWidth  / 2 - c.x * s,
      y: vp.clientHeight / 2 - c.y * s,
    }
    const start = { ...panRef.current }
    const t0 = performance.now()
    const dur = 350
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) { setPan(target); return }
    let raf: number
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      // ease-in-out quadratic
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      setPan({ x: start.x + (target.x - start.x) * e, y: start.y + (target.y - start.y) * e })
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [flyTarget]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── World coordinate from screen coordinate ──
  // A1: CRITICAL — divides by scaleRef.current so every screen↔world conversion
  // stays correct under zoom. This is the SINGLE coord-conversion fn; all hit-tests
  // (node drag, drag-to-link, conn snap) call this and inherit the division.
  const toWorld = (clientX: number, clientY: number) => {
    const r = vpRef.current!.getBoundingClientRect()
    const s = scaleRef.current
    return {
      x: (clientX - r.left - panRef.current.x) / s,
      y: (clientY - r.top  - panRef.current.y) / s,
    }
  }

  // A1: viewport-space distance between two pointer positions
  const pinchDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(b.x - a.x, b.y - a.y)

  // A1: midpoint of two pointer positions in viewport (screen) space
  const pinchMid = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  // ── Pointer handlers ──
  // A1: all pointer-down/move/up handlers maintain activePointers map so we can
  // detect when exactly two fingers are down and start/update pinch-zoom.

  const onNodeDown = (e: React.PointerEvent<HTMLDivElement>, n: ConsoleNode) => {
    // If clicked on the link-drag handle, skip — handled by onHandleDown
    if ((e.target as HTMLElement).dataset.handle) return
    e.stopPropagation()
    // A1: track pointer in the shared map
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    onSelect(n.id)
    const w = toWorld(e.clientX, e.clientY)
    setDrag({ id: n.id, dx: w.x - n.x, dy: w.y - n.y, moved: false })
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch {}
  }

  const onHandleDown = (e: React.PointerEvent<HTMLSpanElement>, n: ConsoleNode) => {
    e.stopPropagation()
    // A1: track pointer
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const w = toWorld(e.clientX, e.clientY)
    setConn({ source: n.id, x: w.x, y: w.y })
    try { vpRef.current?.setPointerCapture(e.pointerId) } catch {}
  }

  const onBgDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // A1: track pointer; if this is the second finger, start pinch instead of pan
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activePointers.current.size === 2) {
      // Two fingers — begin pinch gesture; cancel any in-progress pan
      setPanning(null)
      const pts = [...activePointers.current.values()]
      const d = pinchDist(pts[0], pts[1])
      const mid = pinchMid(pts[0], pts[1])
      pinchRef.current = {
        startDist:  d,
        startScale: scaleRef.current,
        startMid:   mid,
        startPan:   { ...panRef.current },
      }
      // Capture the viewport so move events keep coming even if fingers leave it
      try { vpRef.current?.setPointerCapture(e.pointerId) } catch {}
      return
    }
    onSelect(null)
    setPanning({ sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y })
    try { vpRef.current?.setPointerCapture(e.pointerId) } catch {}
  }

  // A1: shared pointer-removal helper — called by up and cancel
  const removePointer = (id: number) => {
    activePointers.current.delete(id)
    // If fewer than 2 fingers remain, end any pinch gesture cleanly
    if (activePointers.current.size < 2) {
      pinchRef.current = null
    }
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // A1: update the pointer position in the map
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }

    // A1: pinch-zoom takes priority when exactly two pointers are down
    if (pinchRef.current && activePointers.current.size === 2) {
      const pts = [...activePointers.current.values()]
      const newDist = pinchDist(pts[0], pts[1])
      const { startDist, startScale, startPan } = pinchRef.current
      if (startDist > 0) {
        const raw = startScale * (newDist / startDist)
        const newScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, raw))
        // Zoom about the original midpoint (viewport space) so that point stays fixed.
        // pan' = mid - (mid - startPan) * (newScale / startScale)
        const mid = pinchRef.current.startMid
        const r = vpRef.current!.getBoundingClientRect()
        // mid relative to viewport origin
        const mx = mid.x - r.left
        const my = mid.y - r.top
        const ratio = newScale / startScale
        const newPanX = mx - (mx - startPan.x) * ratio
        const newPanY = my - (my - startPan.y) * ratio
        scaleRef.current = newScale
        setScale(newScale)
        setPan({ x: newPanX, y: newPanY })
      }
      return
    }

    if (drag) {
      const w = toWorld(e.clientX, e.clientY)
      onMoveNode(drag.id, Math.round(w.x - drag.dx), Math.round(w.y - drag.dy))
      if (!drag.moved) setDrag({ ...drag, moved: true })
    } else if (conn) {
      const w = toWorld(e.clientX, e.clientY)
      setConn({ ...conn, x: w.x, y: w.y })
    } else if (panning) {
      setPan({ x: panning.px + (e.clientX - panning.sx), y: panning.py + (e.clientY - panning.sy) })
    }
  }

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (conn) {
      const w = toWorld(e.clientX, e.clientY)
      const hit = nodes.find((n) =>
        n.id !== conn.source &&
        w.x >= n.x && w.x <= n.x + NODE_W &&
        w.y >= n.y && w.y <= n.y + NODE_H
      )
      if (hit) onCreateEdge(conn.source, hit.id)
    }
    removePointer(e.pointerId)
    setDrag(null)
    setConn(null)
    setPanning(null)
  }

  // A1: pointercancel — iOS fires this aggressively; clean up like onUp but without
  // the drag-to-link commit (the gesture was interrupted, not completed intentionally)
  const onCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    removePointer(e.pointerId)
    setDrag(null)
    setConn(null)
    setPanning(null)
  }

  // A1: desktop wheel-zoom (nice-to-have per task spec).
  // Attached via useEffect with { passive: false } so e.preventDefault() works —
  // React 18+ registers synthetic onWheel as passive by default, which blocks
  // preventDefault and lets the browser scroll instead of zooming the canvas.
  useEffect(() => {
    const vp = vpRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = vp.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      const delta = -e.deltaY * 0.001
      const raw = scaleRef.current * (1 + delta)
      const newScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, raw))
      const ratio = newScale / scaleRef.current
      const newPanX = mx - (mx - panRef.current.x) * ratio
      const newPanY = my - (my - panRef.current.y) * ratio
      scaleRef.current = newScale
      setScale(newScale)
      setPan({ x: newPanX, y: newPanY })
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, []) // vpRef.current is stable after mount; scaleRef/panRef are always current

  // ── Auto-arrange — tidy 3-column grid, 400ms animated ──
  const arrange = () => {
    setArranging(true)
    const cols = 3, gx = 230, gy = 158, ox = 90, oy = 70
    nodes.forEach((n, i) => onMoveNode(n.id, ox + (i % cols) * gx, oy + Math.floor(i / cols) * gy))
    setPan({ x: 0, y: 0 })
    setTimeout(() => setArranging(false), 440)
  }

  // ── Per-element opacity ──
  const nodeOpacity = (n: ConsoleNode): number => {
    let op = 1
    if (activeFilter !== 'all' && n.kind !== activeFilter) op = Math.min(op, 0.2)
    if (query) op = matchesQuery(n) ? op : Math.min(op, 0.15)
    if (hoveredId && !adj(hoveredId).has(n.id)) op = Math.min(op, 0.25)
    return op
  }

  const edgeState = (e: ConsoleEdge): 'active' | 'dim' | 'base' => {
    if (hoveredId) {
      return (e.source === hoveredId || e.target === hoveredId) ? 'active' : 'dim'
    }
    const sNode = nodes.find((n) => n.id === e.source)
    const tNode = nodes.find((n) => n.id === e.target)
    const sH = sNode ? nodeOpacity(sNode) < 0.5 : false
    const tH = tNode ? nodeOpacity(tNode) < 0.5 : false
    return (sH || tH) ? 'dim' : 'base'
  }

  const byId = (id: string) => nodes.find((n) => n.id === id)

  const nodeCount  = String(nodes.length).padStart(3, '0')
  const edgeCount  = String(edges.length).padStart(3, '0')
  // A1: isPinned also checks scale — "ORIGIN" means pan at zero AND scale at 1
  const isPinned   = pan.x === 0 && pan.y === 0 && scale === 1
  const scalePct   = Math.round(scale * 100)

  return (
    <>
      <style>{CANVAS_CSS}</style>
      <div className="canvas-frame">
        <div
          ref={vpRef}
          className="canvas-viewport paper-canvas"
          role="region"
          aria-label="Worldline graph editor"
          onPointerDown={onBgDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          style={{ cursor: panning ? 'grabbing' : 'default' }}
        >
          {/* α watermark — 0.4× parallax, no CSS transition (synchronous per spec).
              A1: parallax stays in viewport (screen) space — pan.x already reflects
              the viewport offset directly, so 0.4× remains correct under zoom. */}
          <div
            className="atlas-alpha-mark"
            style={{ transform: `translate(${pan.x * 0.4}px, ${pan.y * 0.4}px)` }}
            aria-hidden="true"
          >
            α
          </div>

          {/* World layer — A1: scale() applied here so all children (nodes + edges)
              zoom together. transform-origin:0 0 on .canvas-world so the pan offset
              is applied first, then scale expands from the top-left origin. */}
          <div className="canvas-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
            {/* Edges */}
            <svg className="canvas-edges" width="2600" height="1800" aria-hidden="true">
              {edges.map((e) => {
                const s = byId(e.source)
                const t = byId(e.target)
                if (!s || !t) return null
                const a = centerOf(s)
                const b = centerOf(t)
                const st = edgeState(e)
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
                return (
                  <g key={e.id} style={{ opacity: st === 'dim' ? 0.15 : 1, transition: 'opacity 150ms ease' }}>
                    <path
                      d={edgePath(a, b)}
                      fill="none"
                      stroke={st === 'active' ? 'var(--ink-primary)' : 'var(--ink-dashed)'}
                      strokeWidth="1"
                      strokeDasharray="4 6"
                    />
                    {e.label && (
                      <foreignObject
                        x={mid.x - 80}
                        y={mid.y - 13}
                        width="160"
                        height="26"
                        style={{ overflow: 'visible' }}
                      >
                        <div className="edge-label-wrap">
                          <span className="edge-label" data-active={st === 'active' ? '1' : undefined}>
                            {e.label}
                          </span>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                )
              })}

              {/* Ghost edge during drag-to-link */}
              {conn && (() => {
                const s = byId(conn.source)
                if (!s) return null
                const a = centerOf(s)
                return (
                  <path
                    d={edgePath(a, { x: conn.x, y: conn.y })}
                    fill="none"
                    stroke="var(--accent-orange)"
                    strokeWidth="1"
                    strokeDasharray="3 5"
                    opacity="0.7"
                  />
                )
              })()}
            </svg>

            {/* Nodes */}
            {nodes.map((n) => {
              const k = KINDS[n.kind]
              const sel = selectedId === n.id
              const isHov = hoveredId === n.id
              const isMatch = Boolean(query) && matchesQuery(n)
              const connTarget = conn && conn.source !== n.id

              return (
                <div
                  key={n.id}
                  className={
                    'kn-card' +
                    (sel     ? ' is-selected' : '') +
                    (isHov   ? ' is-hover'    : '') +
                    (arranging ? ' is-arranging' : '')
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.kind} ${n.fileId}: ${n.title}`}
                  aria-selected={sel}
                  style={{
                    left: n.x,
                    top:  n.y,
                    width: NODE_W,
                    minHeight: NODE_H,
                    opacity: nodeOpacity(n),
                    borderColor: isMatch ? 'var(--accent-orange)' : undefined,
                    boxShadow: connTarget ? '0 0 0 4px var(--accent-orange-soft)' : undefined,
                  }}
                  onPointerDown={(e) => onNodeDown(e, n)}
                  onMouseEnter={() => onHover(n.id)}
                  onMouseLeave={() => onHover(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(n.id)
                    }
                  }}
                >
                  <span className="kn-reticle tl" />
                  <span className="kn-reticle br" />
                  <div className="kn-row">
                    <span className="kn-glyph" style={{ color: k.color }}>{k.glyph}</span>
                    <span className="kn-fileid">{n.fileId}</span>
                  </div>
                  <div className="kn-title">{n.title}</div>
                  <span
                    className="kn-handle"
                    data-handle="1"
                    title="drag to link"
                    onPointerDown={(e) => onHandleDown(e, n)}
                  />
                </div>
              )
            })}
          </div>

          {/* HUD — four corner readouts */}
          <div className="atlas-hud">
            <div className="atlas-hud-corner tl">
              WORLDLINE · AUTHORING<br />
              <b className="acc">GRAPH</b> EDITOR
            </div>
            <div className="atlas-hud-corner tr">
              {activeFilter === 'all' ? 'FIELD · ALL TRACES' : `FILTER · ${activeFilter.toUpperCase()}`}
              <br />
              {query ? <span><b className="acc">⌕</b> {query.toUpperCase()}</span> : 'SURVEY · OPEN'}
            </div>
            <div className="atlas-hud-corner br">
              PINNED · <b>{isPinned ? 'ORIGIN' : 'DRIFT'}</b>
            </div>
          </div>

          {/* HUD control cluster BL */}
          <div className="canvas-hud-controls">
            <div className="hud-readout">
              <span>NODES · <b>{nodeCount}</b></span>
              <span>EDGES · <b>{edgeCount}</b></span>
            </div>
            {/* A1: zoom readout */}
            <div className="hud-zoom-readout" aria-live="polite" aria-label={`zoom ${scalePct}%`}>
              ZOOM · <b>{scalePct}%</b>
            </div>
            <button
              type="button"
              className="hud-btn"
              onClick={arrange}
              title="auto-arrange layout"
            >
              ⟳ ARRANGE
            </button>
            {/* A1: FIT / 100% reset — resets both pan and scale to origin */}
            <button
              type="button"
              className="hud-btn"
              onClick={() => { setPan({ x: 0, y: 0 }); setScale(1); scaleRef.current = 1 }}
              title={scale !== 1 ? 'reset zoom to 100%' : 'reset view to origin'}
              aria-label="reset zoom and pan to origin"
            >
              ⊕ {scale !== 1 ? '100%' : 'ORIGIN'}
            </button>
          </div>

          {/* Empty canvas message */}
          {nodes.length === 0 && (
            <div className="canvas-empty">
              no entries in graph — add one below
            </div>
          )}
        </div>
      </div>
    </>
  )
}
