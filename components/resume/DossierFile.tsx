import type { ArchiveNode } from "@/lib/netra/archive";
import { DOMAIN_SHORT, type ExperienceEntry, type Lifecycle } from "@/lib/resume-data";

/**
 * DossierFile — one § EXPERIENCE entry. Ported from `.entry-card
 * data-survey="file-NNN"` in `Worldline Résumé - NETRA Survey.dc.html`
 * (social.plus block, lines 85-116, is the fullest example — KEY RESULT
 * margin + extraBullets "SURVEY FULL TRACE" `<details>`).
 *
 * Layout is `.ledger-entry` (app/survey-ledger.css): 200px meta column |
 * flexible body column, collapsing to one column ≤880px. `.entry-card`
 * + `.entry-glitch` are existing globals.css atoms (hover title-underline
 * + background wash — see ChapterIndex.tsx for the same combination).
 *
 * Only globals.css defines `.lifecycle--ongoing/--refined/--settled` — a
 * plain "seed" lifecycle has no modifier class in the design system, so
 * `lifecycleClass` deliberately omits one rather than emit a dead class.
 */
function lifecycleClass(lc: Lifecycle): string {
  return lc === "seed" ? "lifecycle" : `lifecycle lifecycle--${lc}`;
}

const LIFECYCLE_GLYPH: Record<Lifecycle, string> = { ongoing: "◎", settled: "◆", refined: "◇", seed: "○" };
const LIFECYCLE_TEXT: Record<Lifecycle, string> = { ongoing: "ONGOING", settled: "SETTLED", refined: "REFINED", seed: "SEED" };

interface DossierFileProps {
  entry: ExperienceEntry;
  node: ArchiveNode;
  /** "001", "002", … — the FILE identifier, already zero-padded. */
  fileNumber: string;
}

export function DossierFile({ entry, node, fileNumber }: DossierFileProps) {
  return (
    <article
      className="entry-card ledger-entry hover:bg-[rgba(212,96,42,0.03)] transition-colors"
      data-survey={node.id}
      data-survey-label={node.label}
      data-entry
      data-domains={entry.domains.join(" ")}
    >
      <div className="ledger-entry-meta">
        <div className="dossier-head flex-col items-start gap-1.5">
          <span className="file">FILE — {fileNumber}</span>
          <span className="coords">
            {entry.coords.lat.toFixed(4)}°N · {entry.coords.lon.toFixed(4)}°E
          </span>
        </div>
        <div className="t-type mt-2.5 text-[11.5px] tracking-[0.04em] text-[var(--ink-primary)]">
          {entry.period.toUpperCase()}
        </div>
        <div className="t-meta mt-1 text-[8px] tracking-[0.22em] text-[var(--ink-faint)]">{entry.location}</div>
        <div className="mt-3">
          <span className={lifecycleClass(entry.lifecycle)}>
            <span className="glyph">{LIFECYCLE_GLYPH[entry.lifecycle]}</span> {LIFECYCLE_TEXT[entry.lifecycle]}
          </span>
        </div>

        {entry.keyResult && (
          <div className="key-result">
            <div className="kr-label">KEY RESULT</div>
            <div className="kr-value">{entry.keyResult.value}</div>
            <div className="kr-detail">
              {entry.keyResult.detail.map((line, i) => (
                <span key={line}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="t-meta mt-3 text-[7.5px] tracking-[0.24em] text-[var(--ink-faint)]">
          {entry.domains.map((d) => DOMAIN_SHORT[d]).join(" · ")}
        </div>
      </div>

      <div className="ledger-entry-body">
        <h3 className="wl-h3 text-[24px]">
          <span className="entry-glitch">{entry.role}</span>
        </h3>
        <div className="t-meta mt-1.5 tracking-[0.2em] text-[var(--ink-primary)]">
          {entry.company}
          {entry.subtitle && (
            <span className="text-[var(--ink-faint)]">
              {" "}
              {"//"} {entry.subtitle}
            </span>
          )}
        </div>

        {entry.lede && <p className="wl-lede text-[14.5px] mt-3 mb-3.5 max-w-[64ch]">{entry.lede}</p>}

        <ul className="mt-3.5 grid gap-2.5 max-w-[74ch] list-none p-0">
          {entry.bullets.map((bullet) => (
            <li key={bullet} className="grid grid-cols-[14px_1fr] gap-2.5">
              <span aria-hidden className="text-[var(--ink-faint)] text-[9px] leading-[2.1]">
                ◇
              </span>
              <span className="wl-body text-[12.5px] leading-[1.7]">{bullet}</span>
            </li>
          ))}
        </ul>

        {entry.extraBullets && entry.extraBullets.length > 0 && (
          <details className="wl-more mt-3">
            <summary className="t-meta inline-block cursor-pointer tracking-[0.24em] text-[var(--ink-soft)] hover:text-[var(--accent-orange)] transition-colors">
              <span className="wc">
                ⟶ SURVEY FULL TRACE — {String(entry.extraBullets.length).padStart(2, "0")} MORE ENTRIES
              </span>
              <span className="wo">⟵ FOLD TRACE</span>
            </summary>
            <ul className="mt-3 grid gap-2.5 max-w-[74ch] list-none p-0">
              {entry.extraBullets.map((bullet) => (
                <li key={bullet} className="grid grid-cols-[14px_1fr] gap-2.5">
                  <span aria-hidden className="text-[var(--ink-faint)] text-[9px] leading-[2.1]">
                    ◇
                  </span>
                  <span className="wl-body text-[12.5px] leading-[1.7]">{bullet}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}
