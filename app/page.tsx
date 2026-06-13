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
// movable-alpha: read the current alpha locus from the store at render time.
// getAlphaPlace() queries is_alpha=true from the places table; always returns a
// Place (falls back to Bangkok if the DB is un-seeded). This is build-time data —
// no client-side fetch needed. revalidatePath in setAlphaPlace clears the cache.
import { getAlphaPlace } from "@/lib/store/reads";

export default async function Home() {
  // movable-alpha: resolve alpha locus server-side so the globe starts at the
  // correct position without a client round-trip or layout shift.
  const alphaPlace = await getAlphaPlace();
  const alphaCoord = { lat: alphaPlace.coord.lat, lon: alphaPlace.coord.lon };

  return (
    <PageShell>
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <SurveyCursor />

        <Nav />
        <HeroBlock alphaCoord={alphaCoord} />

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
