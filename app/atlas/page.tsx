import type { Metadata } from "next";
import { CornerMarks } from "@/components/CornerMarks";
import { Nav } from "@/components/Nav";
import { HeroBlock } from "@/components/HeroBlock";
import { ChapterIndex } from "@/components/ChapterIndex";
import { AttractorFields } from "@/components/AttractorFields";
import { FooterManifesto } from "@/components/FooterManifesto";
import { DivergenceMeter } from "@/components/DivergenceMeter";
import { PageShell } from "@/components/PageShell";
import { SurveyCursor } from "@/components/SurveyCursor";
import { MarginaliaHUD, ScrollMeter } from "@/components/MarginaliaHUD";

/**
 * /atlas — the observatory landing, moved verbatim off root `/` (S5 root
 * swap: resume.neoex.dev's ledger now owns `/`). This metadata is the exact
 * copy that used to live as the site-wide default in app/layout.tsx — it
 * describes THIS surface, not the résumé, so it moves here explicitly
 * rather than being left to fall through from a root layout whose default
 * is now recruiter-facing. Ported, not authored — Sirius does not invent copy.
 */
export const metadata: Metadata = {
  title: "Worldline · ∇ Neospirit",
  description:
    "An archive of unfinished thought, kept openly. A digital garden — fragments, drafts, and half-formed theories on coffee, code, narrative, and the architecture of taste.",
};

export default function Home() {
  return (
    <PageShell>
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <SurveyCursor />

        <Nav />
        <HeroBlock />

        {/* Divergence band — full-width, ink-tinted strip per v2 mockup */}
        <section
          data-section="hero"
          className="relative z-[3] px-10 py-9 section-rule"
          style={{ background: "rgb(var(--ink-rgb) / 0.03)" }}
        >
          <DivergenceMeter size="lg" />
        </section>

        <ChapterIndex />
        <AttractorFields />
        <FooterManifesto />
      </main>
    </PageShell>
  );
}
