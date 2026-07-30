import { ARCHIVE } from "@/lib/netra/archive";
import { EXPERIENCE } from "@/lib/resume-data";
import { DossierFile } from "./DossierFile";
import { SectionLabel } from "./SectionLabel";

/**
 * ExperienceSection — § 001 EXPERIENCE // THE SURVEYED TRACE. One
 * DossierFile per lib/resume-data.ts EXPERIENCE entry (5 today).
 *
 * `FILE_NODES` is `ARCHIVE` filtered to ids that start with "file-" —
 * not a re-derivation of lib/netra/archive.ts's `fileId()` formula (that
 * function is private to that module and this component doesn't own it).
 * `buildFileNodes()` there maps 1:1 over the same EXPERIENCE array in the
 * same order, so zipping by index is exact. If the two arrays ever drift
 * in length, `DossierFile` receives `node === undefined` and its required
 * `node` prop throws a type error at compile time — a real EXPERIENCE/
 * ARCHIVE mismatch fails `next build`, not just this component.
 */
const FILE_NODES = ARCHIVE.filter((n) => n.id.startsWith("file-"));

export function ExperienceSection() {
  return (
    <section aria-label="Experience" className="relative z-[3] px-6 sm:px-11 pt-8">
      <SectionLabel num="001" label="EXPERIENCE // THE SURVEYED TRACE" />

      {/*
        Entries render as direct <section> children — no wrapper div, no
        extra dashed divider between them. The design gives every entry a
        solid hairline border-bottom EXCEPT the last one (file-005, AVA
        Advisory); `.ledger-entry:not(:last-child)` in survey-ledger.css
        reproduces that exactly, which only works if these are true
        siblings (an earlier version wrapped each in its own <div> with a
        `.section-rule-dashed` sibling — that broke `:last-child` and
        doubled the rule between entries; removed during audit).
      */}
      {EXPERIENCE.map((entry, i) => {
        const node = FILE_NODES[i];
        if (!node) {
          throw new Error(
            `ExperienceSection: no archive node for EXPERIENCE[${i}] ("${entry.company}") — lib/netra/archive.ts and lib/resume-data.ts have drifted.`
          );
        }
        return <DossierFile key={node.id} entry={entry} node={node} fileNumber={String(i + 1).padStart(3, "0")} />;
      })}
    </section>
  );
}
