"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore } from "react";
import { getNode, STRATA_READOUT } from "@/lib/netra/archive";
import { NetraReticle } from "./NetraReticle";
import { PointModeOverlay } from "./PointModeOverlay";
import { SurveyTranscript } from "./SurveyTranscript";
import {
  clearNetraLog,
  commitNetraLog,
  getNetraLogServerSnapshot,
  getNetraLogSnapshot,
  isTypingTarget,
  setNetraLog,
  subscribeNetraLog,
  type NetraTarget,
  type NetraTurn,
} from "./netra-bay-local";
import { useNetraChat } from "./useNetraChat";
import { usePointMode } from "./usePointMode";
import "./netra-bay.css";

/**
 * NetraBay — the L1/L2 NETRA console docked to the bottom of the survey
 * ledger. Behavioral reference: NETRA Bay.dc.html lines 96-311 (the
 * prototype's `retrieve`/`ask`/`pick`/`save` methods). Markup reference for
 * the `.atlas-netra` console block: WorldlineGlobe.tsx lines 1124-1153.
 *
 * STREAMING (S8): `ask()` now goes live through `useNetraChat` (a real
 * `/api/chat` POST, SSE UI-message stream) with `askOffline`
 * (netra-bay-local.ts) as the fallback for every failure mode — network
 * reject, non-2xx (incl. 503 when no gateway key is configured), a 6s
 * silent stream, or a 429 dormancy window. Fallback results are marked
 * `· local` so a live answer stays visibly distinguishable; see
 * useNetraChat.ts's header comment for the full fallback matrix.
 *
 * `log`/`target` are read via `useSyncExternalStore` (netra-bay-local.ts),
 * not `useState` + a hydration `useEffect`. That is a fix, not a style
 * choice: this repo's eslint-config-next ships the React Compiler's
 * `Recommended` preset, which errors on (a) writing a ref during render and
 * (b) calling `setState` synchronously inside a `useEffect` body — exactly
 * the two things a naive `useEffect(() => setLog(loadFromStorage()), [])`
 * hydration does. `useSyncExternalStore` is React's own mechanism for "read
 * a client-only value without a hydration mismatch": SSR and the first
 * client paint both use `getNetraLogServerSnapshot` (empty), and React
 * itself reconciles against `getNetraLogSnapshot` right after mount — no
 * effect, no ref write, same badge-goes-00-then-NN behavior as before.
 * `pick`/`ask` read the fresh snapshot via `getNetraLogSnapshot()` at
 * call-time (not the component's own `log`/`target` render closure) so two
 * asks fired back-to-back before a re-render can't clobber each other —
 * the same freshness guarantee the prototype got from `this.state` in a
 * class component.
 *
 * Seams: S8 (streaming, this slice) swapped the `askOffline()` call inside
 * `ask()` for `useNetraChat().streamAsk()`, which returns the same
 * `{ ms, count, answer }` shape plus a `local` flag — the one addition to
 * the shape, needed so the final result line can honestly say "· local"
 * only when the answer actually came from the offline fallback. Everything
 * else around the seam (pending-turn push, `pendingRef` guard, turn patch
 * by uid, `commitNetraLog`, `announce`) is unchanged, now wrapped in
 * try/finally so a rejected/aborted stream can never wedge the input —
 * though in practice `streamAsk` never rejects; it resolves to a local
 * fallback internally on every failure path.
 *
 * POINT MODE (S9): `usePointMode` (usePointMode.ts) owns the armed state,
 * the document-level pointermove/click/pointerup capture listeners, and
 * the crosshair cursor; it calls back into this component's own `pick`
 * (the same path a direct point-mode click on the prototype always used).
 * `<PointModeOverlay>` is rendered from here rather than as a literal
 * sibling under `<SurveyLedgerShell>` (the plan's component-architecture
 * sketch shows it as one) — a documented, zero-blast-radius deviation:
 * `PointModeOverlay` portals its DOM straight to `document.body` via
 * `createPortal`, so its position in the React tree has no bearing on
 * where it paints or how it stacks; declaring it here keeps the whole
 * point-mode seam (button, ref, overlay) inside the one file that already
 * carried the S9 TODO markers, instead of threading an extra ref prop
 * through `SurveyLedgerShell` for a purely cosmetic tree-shape match.
 */

export interface NetraBayHandle {
  /** Local "inspect a surface" — the same path usePointMode's onPick calls (S9). */
  pick: (id: string, label: string) => void;
}

export interface NetraBayProps {
  /** RANGE readout value, e.g. "23 SURFACES". Defaults to the full-archive reading. */
  range?: string;
  /** RETICLE readout value, e.g. "13.75°N". Defaults to the full-archive reading. */
  ret?: string;
  ref?: React.Ref<NetraBayHandle>;
}

export function NetraBay({ range = STRATA_READOUT.all.range, ret = STRATA_READOUT.all.ret, ref }: NetraBayProps) {
  const { log, target } = useSyncExternalStore(subscribeNetraLog, getNetraLogSnapshot, getNetraLogServerSnapshot);
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { streamAsk, remaining, abort } = useNetraChat();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingRef = useRef(false);

  const announce = useCallback((text: string) => setAnnouncement(text), []);

  const pick = useCallback(
    (id: string, label: string) => {
      const t0 = performance.now();
      const node = getNode(id);
      const ms = Math.max(1, Math.round(performance.now() - t0));
      const entry: NetraTurn = {
        uid: crypto.randomUUID(),
        q: null,
        scope: "SURVEYING SURFACE",
        fn: `inspect(${label.toLowerCase()})`,
        result: `resolved · 1 dossier · ${ms}ms`,
        a: node ? node.brief : "a surveyed surface. ask, and i'll read it aloud.",
      };
      const nextTarget: NetraTarget = { id, label };
      commitNetraLog({ log: [...getNetraLogSnapshot().log, entry], target: nextTarget });
      setOpen(true);
      announce(entry.a ?? "");
    },
    [announce]
  );

  useImperativeHandle(ref, () => ({ pick }), [pick]);

  const pointButtonRef = useRef<HTMLButtonElement | null>(null);
  const { armed: pointArmed, toggle: togglePointMode, disarm: disarmPointMode, overlayRef: pointOverlayRef } =
    usePointMode({ onPick: pick });

  const ask = useCallback(
    async (query: string) => {
      if (pendingRef.current) return; // one in-flight ask — instrument is "borne"
      pendingRef.current = true;

      const uid = crypto.randomUUID();
      const fnQuery = query.length > 42 ? `${query.slice(0, 42)}…` : query;
      const pendingTurn: NetraTurn = {
        uid,
        q: query,
        scope: "SURVEYING ARCHIVE",
        fn: `search_archive("${fnQuery}")`,
        result: "borne · awaiting the archive",
        a: null,
      };
      const beforeAsk = getNetraLogSnapshot();
      setNetraLog({ log: [...beforeAsk.log, pendingTurn], target: beforeAsk.target });
      setOpen(true);

      try {
        // ── S8 seam ── streams live via /api/chat; falls back to askOffline
        // internally (see useNetraChat.ts) on any network/HTTP/timeout/
        // dormancy failure. `local` marks which one actually answered.
        const { ms, count, answer, local } = await streamAsk(uid, query, beforeAsk.target?.id ?? null);

        const nStr = String(count).padStart(2, "0");
        const afterAsk = getNetraLogSnapshot();
        const resolvedLog = afterAsk.log.map((t) =>
          t.uid === uid
            ? { ...t, a: answer, result: `resolved · ${nStr} entries · ${local ? "local · " : ""}${ms}ms` }
            : t
        );
        commitNetraLog({ log: resolvedLog, target: afterAsk.target });
        announce(answer);
      } finally {
        pendingRef.current = false;
      }
    },
    [announce, streamAsk]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter" || pendingRef.current) return;
      const value = e.currentTarget.value.trim();
      if (!value) return;
      e.currentTarget.value = "";
      void ask(value);
    },
    [ask]
  );

  const handleClear = useCallback(() => {
    abort();
    clearNetraLog();
    pendingRef.current = false;
  }, [abort]);

  // '/' focuses the survey input from anywhere on the page (guarded when
  // already typing elsewhere). Escape disarms point-mode and returns focus
  // to the ⟶ POINT button — `disarmPointMode` is safe to call even when
  // already disarmed (setState to the same value bails out), so this
  // never needs to read `pointArmed` first; it only skips the focus move
  // when there was nothing to disarm, so Escape elsewhere on the page
  // (not pointing) doesn't yank focus around.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/") {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && pointArmed) {
        disarmPointMode();
        pointButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pointArmed, disarmPointMode]);

  const targetLabel = target ? target.label : "no target · full archive";

  // Armed-label text differs by input class: touch has no hover reticle,
  // so it tells the visitor to tap instead of citing a key that doesn't
  // apply. `pointArmed` starts (and stays, until a client click) `false`
  // on both server and first client paint, so this `matchMedia` read is
  // only ever reached after hydration — no SSR crash, no mismatch.
  const pointLabel = !pointArmed
    ? "⟶ POINT"
    : typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
      ? "◉ POINTING — TAP A SURFACE"
      : "◉ POINTING — ESC";

  return (
    <div data-netra-root>
      {/* The one canonical live region for the bay — announces a finished
          answer exactly once. The console box below is intentionally NOT
          also a live region: it and this span would otherwise both fire on
          every pick()/ask(), announcing the target/reticle/range readout
          twice over. */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      <SurveyTranscript open={open} log={log} onClearAction={handleClear} />

      <div data-bay-row>
        <div data-bay-console className="atlas-netra">
          <NetraReticle />
          <span className="id-box">
            <span className="lab">◎ NETRA</span>
            <span className="tgt">{targetLabel}</span>
          </span>
          <span className="readout">
            <span>RETICLE</span>
            <b>{ret}</b>
            <span>RANGE</span>
            <b>{range}</b>
          </span>
        </div>

        <div data-bay-field className="survey-field">
          <span className="lab">◎ SURVEY</span>
          <input
            ref={inputRef}
            type="text"
            data-netra-input-el
            placeholder="query the surveyed archive — or ⟶ point at a surface"
            aria-label="Survey the archive"
            onKeyDown={handleInputKeyDown}
          />
          <span className="key" aria-hidden="true">
            ⏎ / /
          </span>
        </div>

        <button
          ref={pointButtonRef}
          type="button"
          className="netra-bay-jump"
          aria-pressed={pointArmed}
          onClick={togglePointMode}
        >
          {pointLabel}
        </button>

        {/* X-NETRA-Remaining, surfaced subtly (instrument register, same
            typographic treatment as the transcript's VISITOR tag) — updated
            on every /api/chat response useNetraChat sees. */}
        {remaining !== null && (
          <span className="t-meta netra-bay-visitor-tag" data-netra-quota>
            QUOTA {remaining}
          </span>
        )}

        <button
          type="button"
          className="netra-bay-jump"
          aria-expanded={open}
          aria-controls="netra-transcript"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "▾" : "▴"} LOG — {String(log.length).padStart(2, "0")}
        </button>
      </div>

      <PointModeOverlay ref={pointOverlayRef} />
    </div>
  );
}
