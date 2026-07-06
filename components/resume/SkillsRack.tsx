import type { ReactNode } from "react";
import { SKILLS } from "@/lib/resume-data";
import { SectionLabel } from "./SectionLabel";
import { requireNode } from "./requireNode";

/**
 * SkillsRack — § 002 SKILLS // THE INSTRUMENT RACK. Ported from the
 * `<dl>` in `Worldline Résumé - NETRA Survey.dc.html` (lines 209-237).
 *
 * `data-skill-row` + `data-domains` are carried on every row, including
 * the cross-domain "Code" row (domains = all four) — same as the design,
 * so Code never dims once S7 wires the strata attribute (it always
 * matches). Only single-domain groups (llm/ml/data/vision) get a
 * `data-survey` pair — `SKILLS[i].id` already matches lib/netra/
 * archive.ts's own `skills-<domain>` id formula (verified via
 * `requireNode`, which throws on drift), so "Code" correctly gets none —
 * that group has no archive node (archive.ts filters to
 * `domains.length === 1`).
 */
function renderHighlighted(items: string, highlight?: string): ReactNode {
  if (!highlight) return items;
  const at = items.indexOf(highlight);
  if (at === -1) return items;
  return (
    <>
      {items.slice(0, at)}
      <span className="skill-highlight">{highlight}</span>
      {items.slice(at + highlight.length)}
    </>
  );
}

export function SkillsRack() {
  return (
    <section aria-label="Skills" className="relative z-[3] px-6 sm:px-11 py-8 ledger-section-rule">
      <SectionLabel num="002" label="SKILLS // THE INSTRUMENT RACK" />

      <dl className="ledger-skills">
        {SKILLS.map((group) => {
          const node = group.domains.length === 1 ? requireNode(group.id) : null;
          return (
            <div key={group.id} data-skill-row data-domains={group.domains.join(" ")} className="contents">
              <dt
                data-survey={node?.id}
                data-survey-label={node?.label}
                className="ledger-skill-label t-meta"
              >
                {group.label.toUpperCase()}
              </dt>
              <dd
                data-survey={node?.id}
                data-survey-label={node?.label}
                className="ledger-skill-value wl-body text-[12.5px]"
              >
                {renderHighlighted(group.items, group.highlight)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
