"use client";

import { useEffect, useRef } from "react";
import type { NetraTurn } from "./netra-bay-local";

/**
 * SurveyTranscript — the L2 panel of the NETRA bay (NetraBay.tsx). Ported
 * from NETRA Bay.dc.html lines 26-57 (the `data-netra-transcript` block).
 *
 * `hidden={!open}` keeps the panel in the DOM at all times (so SSR and the
 * first client render agree — no hydration mismatch) while excluding it
 * visually and from the accessibility tree when closed. `role="log"
 * aria-live="off"` on the scroll region means the transcript itself does
 * not auto-announce every mutation to assistive tech — NetraBay owns a
 * separate always-mounted `aria-live="polite"` region that announces each
 * finished answer exactly once, regardless of whether this panel is open.
 *
 * `onClearAction` (not `onClear`) — repo convention for a function prop on
 * a `"use client"` component: name it like a Server Action even when both
 * ends are client code today, since Next's client-boundary serialization
 * check runs per-export on the whole "use client" module, not per actual
 * call site, so it can't tell this callback will never cross a server
 * boundary.
 */
export function SurveyTranscript({
  open,
  log,
  onClearAction,
}: {
  open: boolean;
  log: NetraTurn[];
  onClearAction: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, log]);

  const isEmpty = open && log.length === 0;

  return (
    <div id="netra-transcript" data-netra-transcript ref={scrollRef} hidden={!open} role="log" aria-live="off">
      <div className="netra-bay-transcript-inner">
        <div className="netra-bay-transcript-head">
          <span className="t-meta netra-bay-transcript-title">◎ NETRA — SURVEY LOG · HELD IN PAPER</span>
          <button type="button" className="netra-bay-clear" onClick={onClearAction}>
            ⟶ CLEAR LOG
          </button>
        </div>

        {isEmpty && (
          <div className="survey-empty">
            <span className="verdict">NO EXCHANGE HELD</span>
            <span className="coords">point ⟶ at a surface, or transmit a query below</span>
          </div>
        )}

        {log.map((turn) => (
          <div key={turn.uid} className="netra-bay-turn">
            {turn.q && (
              <div className="netra-bay-visitor">
                <span className="t-meta netra-bay-visitor-tag">VISITOR ⟶</span>
                <span className="netra-bay-visitor-q">{turn.q}</span>
              </div>
            )}
            <div className="netra-toolcall">
              <span className="call">
                {turn.scope} · <code>{turn.fn}</code>
              </span>
              <span className="result">{turn.result}</span>
            </div>
            {turn.a && (
              <div className="atlas-netra-voice">
                <span className="voice-tag">NETRA</span>
                <span className="voice-body">{turn.a}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
