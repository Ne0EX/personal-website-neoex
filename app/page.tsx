import type { Metadata } from "next";
import { CornerMarks } from "@/components/CornerMarks";
import { Colophon } from "@/components/resume/Colophon";
import { ExperienceSection } from "@/components/resume/ExperienceSection";
import { LedgerFooter } from "@/components/resume/LedgerFooter";
import { LedgerHero } from "@/components/resume/LedgerHero";
import { LedgerTopBar } from "@/components/resume/LedgerTopBar";
import { ProvenanceSection } from "@/components/resume/ProvenanceSection";
import { SkillsRack } from "@/components/resume/SkillsRack";
import { WorksSection } from "@/components/resume/WorksSection";
import { HERO } from "@/lib/resume-data";
import "./survey-ledger.css";

/**
 * `/` — resume.neoex.dev's NETRA Survey ledger. Root swap (S5): this
 * replaced the observatory landing, which now lives verbatim at `/atlas`.
 *
 * Recruiter-facing metadata per the plan: title names the observer, the
 * description IS `HERO.lede` (not a rewrite of it — one copy of that
 * sentence, not two that can drift), canonical + openGraph point at the
 * production domain. `metadataBase` (app/layout.tsx) lets `canonical`/
 * `url` below stay absolute without duplicating the domain string.
 */
export const metadata: Metadata = {
  title: 'Krittiphong "Peat" Manachamni — AI Engineer',
  description: HERO.lede,
  alternates: {
    canonical: "https://resume.neoex.dev",
  },
  openGraph: {
    type: "profile",
    title: 'Krittiphong "Peat" Manachamni — AI Engineer',
    description: HERO.lede,
    url: "https://resume.neoex.dev",
    firstName: HERO.firstName,
    lastName: HERO.lastName,
  },
};

/**
 * Composition is fully server-rendered — no client shell yet. This is
 * deliberately the STATIC slice: `data-stratum-root` is the seam S7's
 * `SurveyLedgerShell` wraps with `"use client"` state (it sets the live
 * `data-stratum` attribute survey-ledger.css §8 dims against, mounts
 * `<StrataConsole>` right after `<LedgerHero>`, and docks `<NetraBay>` +
 * its clearance spacer at the end of `<main>`, per the plan's component
 * tree). Nothing here re-renders on stratum change; only that wrapper will.
 *
 * `main.paper-canvas.ledger-root` is the exact hook survey-ledger.css's
 * `@media print` block (`main.paper-canvas.ledger-root`) and `.ledger-root`
 * entrance animation (§2) both target — the two classes must land on the
 * same element, not split across a wrapper.
 */
export default function ResumeLedgerPage() {
  return (
    <main
      className="paper-canvas ledger-root relative min-h-screen"
      data-screen-label="RÉSUMÉ · NETRA SURVEY"
    >
      <CornerMarks />
      <LedgerTopBar />
      <LedgerHero />

      <div data-stratum-root>
        <ExperienceSection />
        <SkillsRack />
        <WorksSection />
        <ProvenanceSection />
        <Colophon />
      </div>

      <LedgerFooter />
    </main>
  );
}
