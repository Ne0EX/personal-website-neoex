import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { getArticles } from '@/lib/content'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/th`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/th/archive`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/en/archive`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/th/photos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/en/photos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ]

  try {
    const articles = await getArticles()
    for (const article of articles) {
      routes.push({
        url: `${SITE_URL}/en/articles/${article.fileNum}`,
        lastModified: article.date ? new Date(article.date) : new Date(),
        changeFrequency: 'monthly',
        priority: 0.8,
      })
      routes.push({
        url: `${SITE_URL}/th/articles/${article.fileNum}`,
        lastModified: article.date ? new Date(article.date) : new Date(),
        changeFrequency: 'monthly',
        priority: 0.8,
      })
    }
  } catch {
    // If store is offline or during isolated static builds, static routes are preserved
  }

  return routes
}
