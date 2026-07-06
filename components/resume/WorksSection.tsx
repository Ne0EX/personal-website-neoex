import { CornerMarks } from "@/components/CornerMarks";
import { WORKS, type WorkEntry } from "@/lib/resume-data";
import { SectionLabel } from "./SectionLabel";
import { requireNode } from "./requireNode";

/**
 * WorksSection — § 003 SELECTED WORKS // SURVEYED TRACES. Ported from
 * `Worldline Résumé - NETRA Survey.dc.html` lines 240-271: three flagship
 * cards in `.ledger-works` (3-col ≥880px, 1-col below), then two inline
 * traces in a wrapped row.
 *
 * `work.id` is already the exact id `lib/netra/archive.ts`'s
 * `buildWorksNodes()` uses (it reads `work.id` directly off the same
 * WORKS array) — `requireNode` just confirms that hasn't drifted.
 *
 * Card body text (desc/grant) renders `lib/resume-data.ts`'s own strings,
 * not the prototype's hand-typed HTML — where the two differ in wording
 * (e.g. "de-biasing news" vs the mock's "de-bias"), the data module wins;
 * Sirius does not retype copy from a design mock over an approved source.
 */
function WorkCard({ work }: { work: WorkEntry }) {
  const node = requireNode(work.id);
  return (
    <div
      className={`entry-card ledger-work-card relative hover:bg-[rgba(212,96,42,0.03)] transition-colors ${
        work.isAlpha ? "ledger-work-card--alpha" : ""
      }`}
      data-survey={node.id}
      data-survey-label={node.label}
      data-entry
      data-domains={work.domains.join(" ")}
    >
      {work.isAlpha && <CornerMarks inset={7} />}
      <div className={`t-meta mb-3.5 tracking-[0.22em] ${work.isAlpha ? "text-[var(--accent-orange)]" : "text-[var(--ink-faint)]"}`}>
        {work.traceLabel}
      </div>
      <h3 className="wl-h3 text-[21px]">
        <span className="entry-glitch">{work.name}</span>
      </h3>
      <p className="wl-body text-[12px] mt-2.5 mb-3">{work.desc}</p>
      {work.metrics && (
        <div className="t-type text-[10.5px] tracking-[0.04em] text-[var(--ink-soft)] leading-[1.9]">
          {work.metrics.map((line, i) => (
            <span key={line}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineWork({ work }: { work: WorkEntry }) {
  const node = requireNode(work.id);
  return (
    <span
      data-survey={node.id}
      data-survey-label={node.label}
      data-entry
      data-domains={work.domains.join(" ")}
      className="t-meta tracking-[0.18em] text-[var(--ink-soft)]"
    >
      <span aria-hidden className="text-[var(--ink-faint)]">
        ◇{" "}
      </span>
      {work.name} — {work.desc}
      {work.grant && (
        <>
          {" · "}
          <span className="t-type tracking-[0.04em]">{work.grant}</span>
        </>
      )}
      {work.period && <> · {work.period}</>}
    </span>
  );
}

export function WorksSection() {
  const flagship = WORKS.filter((w) => w.kind === "flagship");
  const inline = WORKS.filter((w) => w.kind === "inline");

  return (
    <section aria-label="Selected works" className="relative z-[3] px-6 sm:px-11 py-8 ledger-section-rule">
      <SectionLabel num="003" label="SELECTED WORKS // SURVEYED TRACES" />

      <div className="ledger-works">
        {flagship.map((work) => (
          <WorkCard key={work.id} work={work} />
        ))}
      </div>

      <div className="ledger-works-inline">
        {inline.map((work) => (
          <InlineWork key={work.id} work={work} />
        ))}
      </div>
    </section>
  );
}
