/**
 * lib/store/mdx.tsx
 * ---------------------------------------------------------------------------
 * MDX body renderer for the store-sourced content layer (DL4).
 *
 * renderMdxBody(source): Promise<React.ReactNode>
 *   Compiles and evaluates raw MDX source from the DB `body` column
 *   using @mdx-js/mdx `evaluate` + react/jsx-runtime server-side.
 *
 * Components available in MDX:
 *   Pullquote — components/Pullquote.tsx (the only custom MDX component in use)
 *
 * Fallback: empty string or null body → returns null (callers render placeholder).
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3 · DL4
 */

import * as runtime from 'react/jsx-runtime'
import { evaluate } from '@mdx-js/mdx'
import type React from 'react'
import { wlcComponents } from './mdxComponents'
import { getArticleByFileNum, getFictionBySlug, getPhotoByRollAndId, getPhotosByRoll } from './reads'

interface MdxNode {
  type: string
  name?: string | null
  children?: MdxNode[]
}

/** Route authored JSX anchors through the same guard as Markdown links. */
function publicAnchorPlugin() {
  return (tree: MdxNode) => {
    function visit(node: MdxNode) {
      if ((node.type === 'mdxJsxTextElement' || node.type === 'mdxJsxFlowElement') && node.name === 'a') {
        node.name = 'PublicAnchor'
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

const PUBLIC_ORIGIN = 'https://neoex.dev'

/** Non-entry, external, and fragment links keep their authored behavior. */
async function isPublishedDestination(url: URL): Promise<boolean> {
  if (url.origin !== PUBLIC_ORIGIN) return true
  const parts = url.pathname.split('/').filter(Boolean)
  const lang = parts[0] === 'th' ? 'th' : 'en'
  if (parts[0] === 'en' || parts[0] === 'th') parts.shift()
  const [kind, first, second] = parts.map(decodeURIComponent)
  if (kind === 'articles' && first && parts.length === 2) {
    return Boolean(await getArticleByFileNum(first, lang))
  }
  if (kind === 'fiction' && first && parts.length === 2) {
    return Boolean(await getFictionBySlug(first, lang))
  }
  if (kind === 'photos' && first && parts.length === 3) {
    return Boolean(await getPhotoByRollAndId(first, second))
  }
  if (kind === 'photos' && first && parts.length === 2) {
    return (await getPhotosByRoll(first)).length > 0
  }
  return true
}

/** Each unique internal destination is checked once per rendered body. */
function createPublicAnchor(pathname: string) {
  const destinations = new Map<string, Promise<boolean>>()
  const base = new URL(pathname, PUBLIC_ORIGIN)
  return async function PublicAnchor({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    if (!href || href.startsWith('#')) return <a href={href} {...props}>{children}</a>
    let published: boolean
    try {
      const url = new URL(href, base)
      const key = `${url.origin}${url.pathname}`
      let check = destinations.get(key)
      if (!check) {
        check = isPublishedDestination(url)
        destinations.set(key, check)
      }
      published = await check
    } catch {
      // A failed publication check must not advertise an unverified destination.
      published = false
    }
    return published
      ? <a href={href} {...props}>{children}</a>
      : <span className={props.className}>{children}</span>
  }
}

// Lazy-import the Pullquote component only when needed (server-only).
// Using a relative path avoids circular dependency through @/components.

let _Pullquote: React.ComponentType<{ children: React.ReactNode; source?: string }> | null = null

async function getPullquote() {
  if (!_Pullquote) {
    const mod = await import('../../components/Pullquote')
    _Pullquote = mod.Pullquote
  }
  return _Pullquote
}

/**
 * Compile and evaluate MDX source server-side, returning a React node.
 * Returns null when source is empty/blank — callers render the placeholder.
 */
export async function renderMdxBody(
  source: string | undefined | null,
  { pathname = '/' }: { pathname?: string } = {},
): Promise<React.ReactNode> {
  if (!source || source.trim() === '') return null

  try {
    const Pullquote = await getPullquote()
    const PublicAnchor = createPublicAnchor(pathname)
    const { default: Content } = await evaluate(source, {
      ...(runtime as Parameters<typeof evaluate>[1]),
      Fragment: runtime.Fragment,
      remarkPlugins: [publicAnchorPlugin],
    })
    return (
      <Content
        components={{
          // Bind all prose elements to .wlc-* classes (shared with editor preview).
          // This is the primary fix for bug-6: bare MDX elements (p, h2, h3, hr,
          // ul, ol, blockquote, code) now carry the class names that .wl-body
          // descendants in globals.css style — eliminating the spacing vacuum on
          // the public /articles route. wlcComponents is extracted to
          // lib/store/mdxComponents.tsx so ArticlePreview shares the same map.
          ...wlcComponents,
          a: PublicAnchor,
          PublicAnchor,
          // Make Pullquote available inside MDX bodies that use <Pullquote> JSX.
          // Plain Markdown (all current bodies) does not use JSX so this is a
          // forward-compat registration — zero cost for bodies without JSX.
          Pullquote: Pullquote ?? undefined,
        }}
      />
    )
  } catch (err) {
    // MDX compile error — fall back to null so caller shows the placeholder.
    // Log at warning level so it surfaces in build/server logs without crashing.
    console.warn('[mdx] renderMdxBody compile error:', err)
    return null
  }
}
