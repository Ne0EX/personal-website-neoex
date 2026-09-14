/**
 * app/[lang]/page.tsx — home page under the [lang] segment
 * ─────────────────────────────────────────────────────────────────────────────
 * Moved from app/page.tsx (bilingual P3 refactor).
 * The [lang] param drives locale-aware public stats and Traces.
 *
 * SPEC: specs/002-restore-exploration-curation/spec.md
 * Owner: Sirius (α-SUR-01) · original observatory composition restored
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
import { getRecentArticles, getWorldlineStats } from '@/lib/content'

// CW-10 · tag pill /?tag= routing (ux-journey, α-SUR-01, 2026-06-14)
interface HomeSearchParams {
  tag?: string
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<HomeSearchParams>
}) {
  const [{ lang }, resolvedParams] = await Promise.all([params, searchParams])
  // Parallel server data fetches — alphaPlace + content stats.
  const [alphaPlace, stats, articles] = await Promise.all([
    getAlphaPlace(),
    getWorldlineStats(lang).catch(() => null),
    getRecentArticles(4, lang),
  ])
  const alphaCoord = { lat: alphaPlace.coord.lat, lon: alphaPlace.coord.lon }
  const initialTag = resolvedParams.tag ?? 'all'
  // Project only the public card fields across the client boundary. Traces
  // must share the detail route's publication source, never a demo fallback.
  const recentEntries = articles.map((article) => ({
    fileNum: article.fileNum,
    title: article.title,
    date: article.date,
    tags: article.tags,
    status: article.status,
    readingTime: article.readingTime,
    lang: article.lang,
  }))

  return (
    /* Restore the original observatory shell while retaining the current
       published, localized data projection and accepted footer. */
    <PageShell>
      <main data-home-production-upper className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <SurveyCursor />

        <Nav />
        <HeroBlock alphaCoord={alphaCoord} stats={stats} />

        {/* attractor-filter: shell holds the shared activeAttractor state */}
        <AttractorFilterShell entries={recentEntries} lang={lang} initialTag={initialTag} />
        <FooterManifesto />
      </main>
    </PageShell>
  )
}
