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
