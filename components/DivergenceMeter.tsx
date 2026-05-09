"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";

type Props = {
  /** The settled, "true" divergence value, e.g. "1.130426". */
  value?: string;
  /** Visual size variant. Hero uses "lg", inline uses "sm". */
  size?: "sm" | "lg";
  /**
   * Compact mode — drops the vertical DIVERGENCE label and the
   * ATTRACTOR/DEVIATION/STATE block; renders just the unstable number.
   */
  compact?: boolean;
};

/**
 * DivergenceMeter — Steins;Gate-style unstable divergence readout.
 *
 * Behavior:
 *   - Mount        : slot-machine reroll → settle on `value`.
 *   - Idle         : per-digit micro-flickers every ~3-7s (a single digit
 *                    briefly cycles to a random glyph then snaps back).
 *   - Worldline drift: every ~14-22s the entire value briefly drifts to an
 *                    adjacent value (±a few in the last 4 digits), state
 *                    flips OBSERVED → DRIFT, then snaps back.
 *   - Reduced motion: settles instantly, no animation.
 */
export function DivergenceMeter({ value = "1.130426", size = "lg", compact = false }: Props) {
  const numRef = useRef<HTMLDivElement | null>(null);
  const stateLabelRef = useRef<HTMLSpanElement | null>(null);
  const deviationRef = useRef<HTMLSpanElement | null>(null);
  const [stateLabel, setStateLabel] = useState("OBSERVED");

  const [head, mid, tail] = (() => {
    const [intPart, frac = ""] = value.split(".");
    return [`${intPart}.`, frac.slice(0, 4).padEnd(4, "0"), frac.slice(4).padEnd(2, "0")];
  })();

  useEffect(() => {
    if (!numRef.current) return;
    const root = numRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const digits = Array.from(root.querySelectorAll<HTMLElement>(".dm-digit"));
    if (reduce) {
      digits.forEach((n) => { n.textContent = n.dataset.final ?? "0"; });
      return;
    }

    // ── 1. Boot reroll ────────────────────────────────────────────
    const intervals: number[] = [];
    digits.forEach((node, i) => {
      const final = node.dataset.final ?? "0";
      let frame = 0;
      const total = 14 + i * 2;
      const id = window.setInterval(() => {
        if (frame >= total) {
          node.textContent = final;
          window.clearInterval(id);
          return;
        }
        node.textContent = String(Math.floor(Math.random() * 10));
        frame += 1;
      }, 38);
      intervals.push(id);
    });

    // ── 2. Per-digit idle flicker — Nixie-tube glitch ─────────────
    const flicker = () => {
      const node = digits[Math.floor(Math.random() * digits.length)];
      if (!node) return;
      const final = node.dataset.final ?? node.textContent ?? "0";
      let f = 0;
      const total = 3 + Math.floor(Math.random() * 4);
      const id = window.setInterval(() => {
        if (f >= total) {
          node.textContent = final;
          window.clearInterval(id);
          return;
        }
        node.textContent = String(Math.floor(Math.random() * 10));
        f += 1;
      }, 50);
      intervals.push(id);
    };
    const flickerLoop = window.setInterval(flicker, 3000 + Math.random() * 4000);

    // ── 3. Worldline drift — full value re-rolls then settles back ─
    const drift = () => {
      // Pick a small random delta on the last 4 digits.
      const delta = Math.floor((Math.random() - 0.5) * 80);
      const baseInt = parseInt(value.replace(".", ""), 10);
      const driftInt = baseInt + delta;
      const driftStr = driftInt.toString().padStart(7, "0");
      const driftDigits = `${driftStr.slice(0, 1)}.${driftStr.slice(1)}`;
      const driftMid = driftDigits.split(".")[1].slice(0, 4).padEnd(4, "0");
      const driftTail = driftDigits.split(".")[1].slice(4).padEnd(2, "0");
      const driftSeq = (driftMid + driftTail).split("");

      // Animate label state.
      setStateLabel("DRIFT");
      if (stateLabelRef.current) {
        animate(stateLabelRef.current, {
          opacity: [{ to: 0.3 }, { to: 1 }],
          duration: 200,
          loop: 4,
          direction: "alternate",
        });
      }

      // Cycle digits for ~700ms then settle on driftSeq, then back to true.
      let f = 0;
      const total = 14;
      const id = window.setInterval(() => {
        if (f >= total) {
          digits.forEach((n, i) => { n.textContent = driftSeq[i] ?? "0"; });
          window.clearInterval(id);

          // Hold the drifted value briefly, then snap back to true value.
          window.setTimeout(() => {
            digits.forEach((n) => { n.textContent = n.dataset.final ?? "0"; });
            setStateLabel("OBSERVED");
          }, 1100);
          return;
        }
        digits.forEach((n) => {
          n.textContent = String(Math.floor(Math.random() * 10));
        });
        f += 1;
      }, 50);
      intervals.push(id);

      // Briefly nudge the deviation readout too.
      if (deviationRef.current) {
        const original = deviationRef.current.textContent ?? "−0.275349%";
        const driftPct = (Math.random() * 1.4 - 0.7).toFixed(6);
        deviationRef.current.textContent = `${parseFloat(driftPct) >= 0 ? "+" : ""}${driftPct}%`;
        window.setTimeout(() => {
          if (deviationRef.current) deviationRef.current.textContent = original;
        }, 1900);
      }
    };
    const driftLoop = window.setInterval(drift, 14_000 + Math.random() * 8_000);

    // ── 4. Slow opacity flicker on the whole block — instrument refresh ─
    const refresh = animate(root, {
      opacity: [
        { to: 1, duration: 2200 },
        { to: 0.86, duration: 600 },
        { to: 1, duration: 1100 },
      ],
      loop: true,
      ease: "inOutSine",
    });

    return () => {
      intervals.forEach(window.clearInterval);
      window.clearInterval(flickerLoop);
      window.clearInterval(driftLoop);
      refresh.pause();
    };
  }, [value]);

  const isLg = size === "lg";
  const numClass = compact
    ? "text-[20px] leading-none tracking-[0.04em]"
    : isLg
      ? "text-[clamp(38px,11vw,64px)] leading-none tracking-[0.05em]"
      : "text-[var(--num-size)] leading-none tracking-[0.04em]";

  const isDrift = stateLabel === "DRIFT";

  if (compact) {
    return (
      <div className="diverge-panel" title={`STATE · ${stateLabel}`}>
        <div className="diverge-panel-head">
          <span className="diverge-panel-label">DIVERGENCE <b>α</b></span>
          <span
            ref={stateLabelRef}
            className={`diverge-panel-state ${isDrift ? "is-drift" : ""}`}
          >
            <span className="diverge-panel-glyph" aria-hidden>{isDrift ? "◆" : "○"}</span>
            {stateLabel}
          </span>
        </div>
        <div ref={numRef} className="diverge-panel-num">
          <span>{head}</span>
          <span className="acc">
            {mid.split("").map((d, i) => (
              <span key={`m${i}`} className="dm-digit" data-final={d}>{d}</span>
            ))}
          </span>
          <span>
            {tail.split("").map((d, i) => (
              <span key={`t${i}`} className="dm-digit" data-final={d}>{d}</span>
            ))}
          </span>
        </div>
        <div className="diverge-panel-meta">
          <span>
            DEVIATION ·{" "}
            <b ref={deviationRef}>−0.275349%</b>
          </span>
          <span>
            ATTRACTOR · <b>Ne0EX-LOCUS</b>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-3 gap-y-2 ${isLg ? "" : "pt-4 border-t border-[var(--ink-faint)]"}`}
    >
      <div
        className="t-meta"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        DIVERGENCE
      </div>

      <div
        ref={numRef}
        className={`t-type ${numClass} text-[var(--ink-primary)] min-w-0`}
      >
        <span>{head}</span>
        <span className="text-[var(--accent-orange)]">
          {mid.split("").map((d, i) => (
            <span key={`m${i}`} className="dm-digit" data-final={d}>{d}</span>
          ))}
        </span>
        <span>
          {tail.split("").map((d, i) => (
            <span key={`t${i}`} className="dm-digit" data-final={d}>{d}</span>
          ))}
        </span>
      </div>

      <div className="ml-auto text-left sm:text-right t-meta leading-[1.7] tracking-[0.12em] flex-shrink-0">
        <div>
          ATTRACTOR · <span className="text-[var(--ink-primary)]">Ne0EX-LOCUS</span>
        </div>
        <div>
          DEVIATION ·{" "}
          <span ref={deviationRef} className="text-[var(--ink-primary)]">
            −0.275349%
          </span>
        </div>
        <div>
          STATE ·{" "}
          <span
            ref={stateLabelRef}
            className={isDrift ? "text-[var(--accent-orange)] font-medium" : "text-[var(--ink-primary)]"}
          >
            {stateLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
