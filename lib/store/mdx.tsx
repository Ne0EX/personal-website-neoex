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
export async function renderMdxBody(source: string | undefined | null): Promise<React.ReactNode> {
  if (!source || source.trim() === '') return null

  try {
    const Pullquote = await getPullquote()
    const { default: Content } = await evaluate(source, {
      ...(runtime as Parameters<typeof evaluate>[1]),
      Fragment: runtime.Fragment,
    })
    return (
      <Content
        components={{
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
