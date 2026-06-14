import { CornerMarks } from "@/components/CornerMarks";
import { Nav } from "@/components/Nav";
import { HeroBlock } from "@/components/HeroBlock";
// attractor-filter: ChapterIndex + AttractorFields are now wired via
// AttractorFilterShell (lifted activeAttractor state). The shell renders both.
// DivergenceMeter stays here (server section) so it NEVER recomputes on filter.
import { AttractorFilterShell } from "@/components/AttractorFilterShell";
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

// CW-10 · tag pill /?tag= routing (ux-journey, α-SUR-01, 2026-06-14)
// Tag links on entry pages link to /?tag=essay etc. The homepage now reads the
// `tag` searchParam and passes it as `initialTag` to AttractorFilterShell.
// Note: reading searchParams forces dynamic rendering on this route — acceptable
// since the page already hits the DB (getAlphaPlace). Does NOT affect the
// attractor-filter state-machine; the shell uses it only as initial state.
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
interface HomeSearchParams {
  tag?: string;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const resolvedParams = await searchParams;
  // movable-alpha: resolve alpha locus server-side so the globe starts at the
  // correct position without a client round-trip or layout shift.
  const alphaPlace = await getAlphaPlace();
  const alphaCoord = { lat: alphaPlace.coord.lat, lon: alphaPlace.coord.lon };
  // CW-10: pass tag from URL to the filter shell as its initial state.
  const initialTag = resolvedParams.tag ?? "all";

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

        {/* attractor-filter: shell holds the shared activeAttractor state;
            renders §01 ChapterIndex (filtered) + §02 AttractorFields (pills).
            DivergenceMeter above is intentionally outside this shell so it
            never re-renders when the filter changes. */}
        <AttractorFilterShell initialTag={initialTag} />
        <FooterManifesto />
      </main>
    </PageShell>
  );
}
