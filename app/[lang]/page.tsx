/**
 * app/[lang]/page.tsx — home page under the [lang] segment
 * ─────────────────────────────────────────────────────────────────────────────
 * Moved from app/page.tsx (bilingual P3 refactor).
 * The [lang] param is available from the route segment but the home page
 * does not currently need it for content (no lang-specific copy in v1 chrome).
 *
 * SPEC: SPEC-2026-06-18-bilingual-translation-group §4.1 (DL3 — chrome stays en in v1)
 * Owner: Altair (α-BND-02) · bilingual P3
 */

import { CornerMarks } from '@/components/CornerMarks'
import { Nav } from '@/components/Nav'
import { HeroBlock } from '@/components/HeroBlock'
import { AttractorFilterShell } from '@/components/AttractorFilterShell'
import { FooterManifesto } from '@/components/FooterManifesto'
import { PageShell } from '@/components/PageShell'
import { SurveyCursor } from '@/components/SurveyCursor'
import { MarginaliaHUD, ScrollMeter } from '@/components/MarginaliaHUD'
import { getAlphaPlace } from '@/lib/store/reads'
import { getWorldlineStats } from '@/lib/content'

// CW-10 · tag pill /?tag= routing (ux-journey, α-SUR-01, 2026-06-14)
interface HomeSearchParams {
  tag?: string
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>
}) {
  const resolvedParams = await searchParams
  // Parallel server data fetches — alphaPlace + content stats.
  const [alphaPlace, stats] = await Promise.all([
    getAlphaPlace(),
    getWorldlineStats(),
  ])
  const alphaCoord = { lat: alphaPlace.coord.lat, lon: alphaPlace.coord.lon }
  const initialTag = resolvedParams.tag ?? 'all'

  return (
    <PageShell>
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <SurveyCursor />

        <Nav />
        <HeroBlock alphaCoord={alphaCoord} stats={stats} />

        {/* attractor-filter: shell holds the shared activeAttractor state */}
        <AttractorFilterShell initialTag={initialTag} />
        <FooterManifesto />
      </main>
    </PageShell>
  )
}
