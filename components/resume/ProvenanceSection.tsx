import { CERTIFICATES, EDUCATION, LANGUAGES, RECOGNITION } from "@/lib/resume-data";
import { SectionLabel } from "./SectionLabel";
import { requireNode } from "./requireNode";

/**
 * ProvenanceSection — § 004 RECOGNITION · ORIGIN // PROVENANCE OF THE
 * OBSERVER. Ported from `Worldline Résumé - NETRA Survey.dc.html` lines
 * 274-310: a 1.4fr/1fr/1fr `.ledger-provenance` row (Recognition / Origin
 * / Languages), then a Certificates strip beneath.
 */
export function ProvenanceSection() {
  const recognitionNode = requireNode("recognition");
  const originNode = requireNode("origin");
  const languagesNode = requireNode("languages");
  const certificatesNode = requireNode("certificates");

  return (
    <section aria-label="Recognition and origin" className="relative z-[3] px-6 sm:px-11 py-8 ledger-section-rule">
      <SectionLabel num="004" label="RECOGNITION · ORIGIN // PROVENANCE OF THE OBSERVER" />

      <div className="ledger-provenance">
        <div data-survey={recognitionNode.id} data-survey-label={recognitionNode.label}>
          <h4 className="t-meta mb-3.5 text-[var(--ink-soft)]">{"//"} RECOGNITION</h4>
          <div className="flex flex-col">
            {RECOGNITION.map((item, i) => (
              <div
                key={item.title}
                className={`grid grid-cols-[16px_1fr] gap-2.5 items-baseline py-2.5 ${
                  i < RECOGNITION.length - 1 ? "section-rule-dashed" : ""
                }`}
              >
                <span className={`text-[10px] ${item.highlight ? "text-[var(--accent-orange)]" : "text-[var(--ink-faint)]"}`}>
                  {item.highlight ? "◆" : "→"}
                </span>
                <div>
                  <span className="wl-lede text-[16px] text-[var(--ink-primary)]">{item.title}</span>{" "}
                  {item.detail && <span className="t-type text-[10px] text-[var(--ink-soft)] tracking-[0.04em]">· {item.detail}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div data-survey={originNode.id} data-survey-label={originNode.label}>
          <h4 className="t-meta mb-3.5 text-[var(--ink-soft)]">{"//"} ORIGIN</h4>
          {EDUCATION.map((edu, i) => (
            <div key={edu.program} className={i < EDUCATION.length - 1 ? "pb-3.5 mb-3.5 section-rule-dashed" : ""}>
              <div className="wl-lede italic text-[16px] leading-[1.3] text-[var(--ink-primary)]">{edu.program}</div>
              <div className="t-meta mt-1.5 tracking-[0.16em] text-[var(--ink-primary)]">{edu.institution}</div>
              <div className="t-type text-[10px] mt-1 tracking-[0.05em] text-[var(--ink-soft)]">{edu.period}</div>
            </div>
          ))}
        </div>

        <div data-survey={languagesNode.id} data-survey-label={languagesNode.label}>
          <h4 className="t-meta mb-3.5 text-[var(--ink-soft)]">{"//"} LANGUAGES</h4>
          {LANGUAGES.map((lang, i) => (
            <div
              key={lang.name}
              className={`flex justify-between items-baseline gap-2.5 py-3 ${i < LANGUAGES.length - 1 ? "section-rule-dashed" : ""}`}
            >
              <span className="wl-lede italic text-[17px] text-[var(--ink-primary)]">{lang.name}</span>
              <span className="t-meta text-right leading-[1.7] text-[var(--ink-soft)]">
                {lang.level}
                {lang.detail && (
                  <>
                    <br />
                    <span className="t-type tracking-[0.04em]">{lang.detail}</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        data-survey={certificatesNode.id}
        data-survey-label={certificatesNode.label}
        className="ledger-hairline-top t-meta mt-4 pt-3.5 pb-2 text-[8px] tracking-[0.2em] leading-[2] text-[var(--ink-faint)]"
      >
        CERTIFICATES — {CERTIFICATES.join(" · ")}
      </div>
    </section>
  );
}
