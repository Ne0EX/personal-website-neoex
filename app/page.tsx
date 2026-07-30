import type { Metadata } from "next";
import { CornerMarks } from "@/components/CornerMarks";
import { Colophon } from "@/components/resume/Colophon";
import { ExperienceSection } from "@/components/resume/ExperienceSection";
import { LedgerFooter } from "@/components/resume/LedgerFooter";
import { LedgerHero } from "@/components/resume/LedgerHero";
import { LedgerTopBar } from "@/components/resume/LedgerTopBar";
import { ProvenanceSection } from "@/components/resume/ProvenanceSection";
import { SkillsRack } from "@/components/resume/SkillsRack";
import { SurveyLedgerShell } from "@/components/resume/SurveyLedgerShell";
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
 * Composition (S7): `SurveyLedgerShell` (`"use client"`) replaces the old
 * static `data-stratum-root` div. It owns the live `data-stratum` value
 * survey-ledger.css §8 dims against, and — since React context can't cross
 * sibling subtrees — it also renders `<StrataConsole>` and docks
 * `<NetraBay>` itself (see that file's header comment for the full
 * reasoning), so every stratum-aware piece shares one provider instance.
 * The five sections below are passed through as `children`: server-
 * rendered, unchanged by SurveyLedgerShell, so a stratum change re-renders
 * only the wrapping `<div>`'s attribute, never these sections themselves.
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

      <SurveyLedgerShell>
        <ExperienceSection />
        <SkillsRack />
        <WorksSection />
        <ProvenanceSection />
        <Colophon />
      </SurveyLedgerShell>

      <LedgerFooter />
    </main>
  );
}
