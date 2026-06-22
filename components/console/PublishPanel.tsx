/**
 * components/console/PublishPanel.tsx — ▲ PUBLISH / TRANSMIT panel (MOCKED)
 * ─────────────────────────────────────────────────────────────────────────────
 * 'use client' — local elapsed counter + reduced-motion query + ESC listener.
 *
 * Cross-kind surface from the build-contract §6 + §"cross-kind PUBLISH":
 *   docs/design/atlas-console-full-editor.md  (Betelgeuse · α-VIS-04 · 2026-06-07)
 *
 * MOCKED ONLY this round. NO live wiring to the velite content layer; no real
 * mutation. Real transmission touches the live-mutating-action gate and is left
 * for a future sub-project with Peat-at-seam (contract §"scope: MOCKED ONLY").
 *
 * Soul-faithful construction (NOT a SaaS modal / NOT the prototype .pub-overlay):
 *   - Surface: var(--paper-warm). Dashed inner border. 4 corner reticles (local
 *     build — globals .corner-marks only draws TL+BR).
 *   - Slides in from the RIGHT edge to cover the preview pane (translateX 100%→0);
 *     the source pane stays visible. NOT a dark-glass backdrop scrim — the
 *     prototype's rgba(22,30,34,0.55) overlay is the SaaS reject the contract
 *     explicitly forbids.
 *   - role="region" (NOT dialog) · aria-live="polite" on the phase-content
 *     wrapper · NO focus trap, NO aria-modal.
 *
 * Phase is CONTROLLER-OWNED (prop, not local state). This component requests the
 * running→done transition via onPhaseChange after a 2s mock delay (contract
 * §states "running phase: elapsed counter (mock: auto-advance after 2s)"). See
 * issues_for_integrator — the caller may prefer to own that timer.
 *
 * Counter is a MONO digit readout, never a spinner (a spinner is SaaS — contract
 * §running "[animated mono counter, no spinner — a spinner is SaaS]").
 *
 * Owner: Sirius (α-SUR-01) · atlas-console full editor
 * Prototype ref: editor-entry.jsx PublishPanel (visual language only — the rich
 *   slugify/path/route/commit-message/log/VIEW-LIVE flow is OUT of contract scope).
 */

'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type {
  EntryKind,
  ArticleMeta,
  PhotoMeta,
  FictionMeta,
  FictionState,
  PhotoFrame,
  FictionChapter,
  PublishPhase,
} from './editor-types'

// ─────────────────────────────────────────────────────────────────────────────
// Props — bound EXACTLY to the contract §6.6 PublishPanelProps interface.
// ─────────────────────────────────────────────────────────────────────────────

interface PublishPanelProps {
  kind: EntryKind
  meta: ArticleMeta | PhotoMeta | FictionMeta
  /** article/photo status (ongoing / settled). */
  status?: string
  /** fiction active-chapter state (draft / settled). */
  fictionState?: FictionState
  /** photo: for frame-count display. */
  frames?: PhotoFrame[]
  /** fiction: for chapter-count display. */
  chapters?: FictionChapter[]
  /** caller controls phase transitions (mocked). */
  phase: PublishPhase
  onPhaseChange: (p: PublishPhase) => void
  onClose: () => void
  /**
   * S6: Real transmit action (setEntryDraft(draft:false)).
   * When provided, CONFIRM TRANSMISSION calls this instead of the 2s mock timer.
   * Returns the error message on failure, null on success.
   */
  onTransmit?: () => Promise<string | null>
  /**
   * S6: The live public URL for the published entry (shown in done phase).
   * E.g. "/articles/003" or "/photos/2026-05-bangkok/DSCF0002"
   */
  publicUrl?: string
  /**
   * S6: Deploy hook URL for REINDEX affordance (DL5). When provided, the done
   * phase shows a REINDEX button that fires a POST to this URL.
   */
  reindexHookUrl?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock-only timing. The running→done auto-advance is a VISUAL mock, not a real
// transmission. 2s per contract §states.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_RUNNING_MS = 2000

// ─────────────────────────────────────────────────────────────────────────────
// Scoped styles — `.pub-*` prefix (publish-panel). Component-local, no globals
// edit (Betelgeuse owns app/globals.css). Buttons use `.pub-btn-*` rather than
// the contract-named `.ed-btn-primary` / `.ed-btn-ghost`: those atoms are NOT in
// globals.css — ImportZone.tsx carries its own (un-prefixed, global-scope)
// definition, which is only present when ImportZone is mounted and would
// duplicate as a global rule if re-emitted here. The `.pub-btn-*` values mirror
// ImportZone's exactly (token-driven) so the instrument reads identically. See
// issues_for_integrator: consolidate to a single canonical atom.
// ─────────────────────────────────────────────────────────────────────────────

const PUBLISHPANEL_CSS = `
/* ── slide-in panel shell ──────────────────────────────────────────────── */
/* Mount assumption: rendered inside a position:relative container that bounds
   the preview pane. Fills that container and slides in from its right edge.
   NOT position:fixed full-viewport — that is the modal shape the contract rejects. */
.pub {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: var(--paper-warm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translateX(0);
  transition: transform 280ms ease;   /* contract motion: PublishPanel slide-in 280ms */
}
.pub.is-entering {
  transform: translateX(100%);
}

/* dashed inner border — drawn as a non-interactive overlay so it sits inside
   the corner reticles without affecting layout box. */
.pub-inner-rule {
  position: absolute;
  inset: 16px;
  border: 1px dashed var(--ink-dashed);
  pointer-events: none;
  z-index: 1;
}

/* ── 4 corner reticles (local build — globals .corner-marks only does TL+BR) ─ */
.pub-reticles {
  position: absolute;
  inset: 16px;
  pointer-events: none;
  z-index: 2;
}
.pub-reticle {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 1px solid var(--accent-orange);
}
.pub-reticle.tl { top: 0; left: 0; border-right: none; border-bottom: none; }
.pub-reticle.tr { top: 0; right: 0; border-left: none; border-bottom: none; }
.pub-reticle.bl { bottom: 0; left: 0; border-right: none; border-top: none; }
.pub-reticle.br { bottom: 0; right: 0; border-left: none; border-top: none; }

/* ── header strip ──────────────────────────────────────────────────────── */
.pub-body {
  position: relative;
  z-index: 3;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 34px 36px;
  overflow-y: auto;
}
.pub-head {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent-orange);
  margin-bottom: 22px;
}
.pub-head-sep { color: var(--ink-faint); }

/* ── phase-content wrapper (aria-live target) ──────────────────────────── */
.pub-phase {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── review phase: meta rows ───────────────────────────────────────────── */
.pub-rows {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 9px 22px;
  align-items: baseline;
  padding-top: 4px;
  border-top: 1px dashed var(--ink-dashed);
  margin-top: 0;
  padding-bottom: 22px;
}
.pub-rows::before {
  content: '';
  grid-column: 1 / -1;
  height: 14px;
}
.pub-k {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-soft);
  white-space: nowrap;
}
.pub-v {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ink-primary);
  word-break: break-word;
}

/* ── review actions ────────────────────────────────────────────────────── */
.pub-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px dashed var(--ink-dashed);
}

/* ── running phase ─────────────────────────────────────────────────────── */
.pub-running {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 14px;
}
.pub-running-head {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-primary);
}
/* mono digit readout — NOT a spinner. Tabular figures so the counter does not
   jitter as digits change. */
.pub-counter {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.pub-counter b {
  color: var(--accent-orange);
  font-weight: 400;
}

/* ── done phase ────────────────────────────────────────────────────────── */
.pub-done {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 14px;
}
.pub-done-head {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--ink-primary);
}
.pub-done-sub {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.pub-done-sub b {
  color: var(--accent-orange);
  font-weight: 400;
}

/* ── instrument buttons (token-driven; mirror ImportZone .ed-btn-* values) ─ */
.pub-btn-primary {
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
.pub-btn-primary:hover {
  background: var(--accent-orange);
  border-color: var(--accent-orange);
  color: var(--paper-bright);
}
.pub-btn-primary:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}
.pub-btn-ghost {
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
.pub-btn-ghost:hover {
  border-color: var(--accent-orange);
  color: var(--ink-primary);
}
.pub-btn-ghost:focus-visible {
  outline: 1px dashed var(--accent-orange);
  outline-offset: 2px;
}

/* ── breakpoints ───────────────────────────────────────────────────────── */
/* ≤880px: stacks vertically, full width (contract §breakpoints). */
@media (max-width: 880px) {
  .pub-body { padding: 28px 24px; }
  .pub-actions { flex-direction: column; align-items: stretch; }
  .pub-actions .pub-btn-primary,
  .pub-actions .pub-btn-ghost { width: 100%; }
}
/* ≤600px: full screen, not a side panel (contract §breakpoints). */
@media (max-width: 600px) {
  .pub {
    position: fixed;
    inset: 0;
    z-index: 60;
  }
  .pub-body { padding: 24px 18px; }
}

/* ── reduced motion ────────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .pub {
    transition: none;
  }
  .pub.is-entering {
    transform: translateX(0);   /* no slide — appear in place */
  }
  .pub-btn-primary,
  .pub-btn-ghost {
    transition: none;
  }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — narrow the union meta for count/state display.
// ─────────────────────────────────────────────────────────────────────────────

/** Two-digit zero-padded count, matching the console's mono readout convention. */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// ─────────────────────────────────────────────────────────────────────────────
// PublishPanel
// ─────────────────────────────────────────────────────────────────────────────

export function PublishPanel({
  kind,
  meta,
  status,
  fictionState,
  frames,
  chapters,
  phase,
  onPhaseChange,
  onClose,
  onTransmit,
  publicUrl,
  reindexHookUrl,
}: PublishPanelProps) {
  // Slide-in: start translated off-screen, then release on mount so the CSS
  // transition runs. `entering` is a one-shot mount flag — NOT a mirror of phase.
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    // Release the slide on the next frame so the transform transition fires.
    const id = requestAnimationFrame(() => setEntering(false))
    return () => cancelAnimationFrame(id)
  }, [])

  // Elapsed counter — the ONLY local phase-derived state. Resets when entering
  // the running phase, ticks once a second while running. Mock readout only.
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    // Reset on every phase change; only tick while running.
    setElapsed(0)
    if (phase !== 'running') return
    const tick = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(tick)
  }, [phase])

  // S6: transmit error state (shown on failure in running phase)
  const [transmitError, setTransmitError] = useState<string | null>(null)
  const [_transmitPending, startTransmitTransition] = useTransition()

  // S6: REINDEX affordance state
  const [reindexStatus, setReindexStatus] = useState<'idle' | 'firing' | 'done' | 'error'>('idle')

  // S6: real transmit — when onTransmit provided, call it instead of the mock timer.
  // Mock auto-advance kept as fallback when onTransmit is not wired (legacy SAMPLE path).
  const onPhaseChangeRef = useRef(onPhaseChange)
  onPhaseChangeRef.current = onPhaseChange
  const onTransmitRef = useRef(onTransmit)
  onTransmitRef.current = onTransmit

  useEffect(() => {
    if (phase !== 'running') return
    if (onTransmitRef.current) {
      // Real path: call the store action
      startTransmitTransition(async () => {
        const error = await onTransmitRef.current!()
        if (error) {
          setTransmitError(error)
          onPhaseChangeRef.current('review')  // bounce back to review with error
        } else {
          setTransmitError(null)
          onPhaseChangeRef.current('done')
        }
      })
    } else {
      // Mock fallback (SAMPLE_DRAFT path, no real entry)
      const id = setTimeout(() => onPhaseChangeRef.current('done'), MOCK_RUNNING_MS)
      return () => clearTimeout(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ESC closes (contract keyboard map is unconditional — unlike the prototype
  // which blocked ESC while running).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── display values ──────────────────────────────────────────────────────
  const fileNum = meta.fileNum
  const kindLabel = kind.toUpperCase()

  // STATUS row: article/photo use entry status; fiction uses active-chapter state.
  const statusValue =
    kind === 'fiction'
      ? (fictionState ?? 'draft').toUpperCase()
      : (status ?? '—').toUpperCase()
  const statusLabel = kind === 'fiction' ? 'STATE' : 'STATUS'

  const frameCount = frames?.length ?? 0
  const chapterCount = chapters?.length ?? 0

  return (
    <>
      <style>{PUBLISHPANEL_CSS}</style>

      <section
        className={'pub' + (entering ? ' is-entering' : '')}
        role="region"
        aria-label="Transmit panel"
      >
        {/* dashed inner border + 4 corner reticles — decorative, non-interactive */}
        <div className="pub-inner-rule" aria-hidden />
        <div className="pub-reticles" aria-hidden>
          <span className="pub-reticle tl" />
          <span className="pub-reticle tr" />
          <span className="pub-reticle bl" />
          <span className="pub-reticle br" />
        </div>

        <div className="pub-body">
          {/* Header strip — TRANSMIT SEQUENCE · {kind} · {fileNum} */}
          <div className="pub-head">
            TRANSMIT SEQUENCE
            <span className="pub-head-sep"> · </span>
            {kindLabel}
            <span className="pub-head-sep"> · </span>
            {fileNum}
          </div>

          {/* Phase-content wrapper — aria-live announces phase changes. */}
          <div className="pub-phase" aria-live="polite">
            {phase === 'review' && (
              <>
                <dl className="pub-rows">
                  <dt className="pub-k">TITLE</dt>
                  <dd className="pub-v">{meta.title}</dd>

                  <dt className="pub-k">KIND</dt>
                  <dd className="pub-v">{kindLabel}</dd>

                  <dt className="pub-k">{statusLabel}</dt>
                  <dd className="pub-v">{statusValue}</dd>

                  {kind === 'photo' && (
                    <>
                      <dt className="pub-k">FRAMES</dt>
                      <dd className="pub-v">{pad2(frameCount)}</dd>
                    </>
                  )}

                  {kind === 'fiction' && (
                    <>
                      <dt className="pub-k">CHAPTERS</dt>
                      <dd className="pub-v">{pad2(chapterCount)}</dd>
                    </>
                  )}
                </dl>

                {/* S6: transmit error from previous attempt */}
                {transmitError && (
                  <div
                    role="alert"
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: '9px',
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: 'var(--accent-orange)', marginBottom: 12,
                    }}
                  >
                    {transmitError}
                  </div>
                )}

                <div className="pub-actions">
                  <button
                    type="button"
                    className="pub-btn-primary"
                    onClick={() => { setTransmitError(null); onPhaseChange('running') }}
                  >
                    CONFIRM TRANSMISSION ▲
                  </button>
                  <button
                    type="button"
                    className="pub-btn-ghost"
                    onClick={onClose}
                  >
                    ABORT ×
                  </button>
                </div>
              </>
            )}

            {phase === 'running' && (
              <div className="pub-running">
                <div className="pub-running-head">TRANSMITTING…</div>
                {/* mono counter, NOT a spinner (contract §running).
                    FIX 3 (Algol REVISE — Betelgeuse contract note b · a11y):
                    aria-live="off" keeps the per-second tick from being announced
                    by screen readers. Phase-change announcements (TRANSMITTING…
                    and TRANSMISSION COMPLETE) still fire because they are
                    siblings inserted into the aria-live="polite" .pub-phase
                    wrapper, not inside this counter node. */}
                <div className="pub-counter" aria-live="off">
                  <b>{pad2(elapsed)}</b> S ELAPSED
                </div>
              </div>
            )}

            {phase === 'done' && (
              <div className="pub-done">
                <div className="pub-done-head">TRANSMISSION COMPLETE</div>
                <div className="pub-done-sub">
                  ENTRY <b>{fileNum}</b> SETTLED
                </div>
                {/* S6: live public URL — DL11 revalidatePath means it's live now */}
                {publicUrl && (
                  <div className="pub-done-sub" style={{ marginTop: 4 }}>
                    LIVE AT <b>{publicUrl}</b>
                  </div>
                )}
                {/* S6: REINDEX affordance — fires the Vercel Deploy Hook for search
                    index rebuild (DL5). Optional: shown only when hookUrl is configured. */}
                {reindexHookUrl && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="pub-btn-ghost"
                      disabled={reindexStatus === 'firing' || reindexStatus === 'done'}
                      onClick={() => {
                        setReindexStatus('firing')
                        fetch(reindexHookUrl, { method: 'POST' })
                          .then(() => setReindexStatus('done'))
                          .catch(() => setReindexStatus('error'))
                      }}
                      title="Trigger a Vercel redeploy so pagefind index includes this entry"
                    >
                      {reindexStatus === 'idle'   ? '⇡ REINDEX (deploy)' :
                       reindexStatus === 'firing' ? 'FIRING…' :
                       reindexStatus === 'done'   ? 'REINDEX QUEUED' :
                                                    'REINDEX FAILED'}
                    </button>
                  </div>
                )}
                <div className="pub-actions" style={{ marginTop: '10px', borderTop: 'none', paddingTop: 0 }}>
                  <button
                    type="button"
                    className="pub-btn-primary"
                    onClick={onClose}
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
