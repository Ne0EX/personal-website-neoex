/**
 * SectionLabel — "§ NNN LABEL" rule reused by every §-numbered ledger
 * section. Modelled after ChapterIndex.tsx's local (unexported)
 * `SectionLabel` helper — lifted to a shared component here since the
 * résumé ledger reuses it four times (Experience/Skills/Works/Provenance).
 */
export function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-3.5 mb-5 t-meta tracking-[0.3em]">
      <span className="block w-[22px] h-px bg-[var(--accent-orange)]" aria-hidden />
      <span className="t-meta-accent">§ {num}</span>
      <span>{label}</span>
    </div>
  );
}
