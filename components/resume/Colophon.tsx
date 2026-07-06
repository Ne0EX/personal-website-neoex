import { CornerMarks } from "@/components/CornerMarks";
import { COLOPHON } from "@/lib/resume-data";
import { requireNode } from "./requireNode";

/**
 * Colophon — the closing "this résumé was built this way" plate. Ported
 * from `Worldline Résumé - NETRA Survey.dc.html` lines 313-321: a bordered,
 * corner-marked box, `grid-template-columns: auto minmax(0,1fr) auto`
 * (label | prose | stack list).
 *
 * The box's background (`rgba(240,235,221,0.45)`) is a literal alpha-
 * composited value straight from the design bundle, same as DossierFile's
 * `hover:bg-[rgba(212,96,42,0.03)]` — `--paper-bright` is stored as a hex
 * literal, not an `R G B` triple, so it can't be alpha-composited via
 * `rgb(var(...) / a)` the way `--ink-rgb`/`--accent-orange` can. The border
 * DOES use the triple form (`--ink-rgb`) since that one supports it.
 *
 * One-off layout (not reused elsewhere on the page), so it stays in
 * Tailwind arbitrary values here rather than adding a `.ledger-colophon`
 * class to survey-ledger.css for a single consumer.
 */
export function Colophon() {
  const node = requireNode("colophon");

  return (
    <section aria-label="Colophon" className="relative z-[3] px-6 sm:px-11 pb-[34px]">
      <div
        data-survey={node.id}
        data-survey-label={node.label}
        className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[26px] border border-[rgb(var(--ink-rgb)/0.22)] bg-[rgba(240,235,221,0.45)] px-6 py-[18px]"
      >
        <CornerMarks inset={-1} />
        <span className="t-meta t-meta-accent leading-[1.8] tracking-[0.26em]">
          COLOPHON
          <br />
          {"//"} THIS SURFACE
        </span>
        <p className="t-display m-0 max-w-[66ch] text-[15px] leading-[1.55] text-[var(--ink-primary)]">
          {COLOPHON.text}
        </p>
        <div className="t-meta text-right text-[7.5px] leading-[2.1] tracking-[0.22em] text-[var(--ink-soft)]">
          {COLOPHON.stack.map((line, i) => (
            <span key={line}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
