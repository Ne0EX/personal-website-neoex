/**
 * lib/store/mdxComponents.tsx
 * ---------------------------------------------------------------------------
 * Shared MDX components map.
 *
 * Binds bare MDX prose elements (p, h2, h3, hr, ul, ol, blockquote, code) to
 * the .wlc-* class names that are styled in two places:
 *
 *   1. app/globals.css — .wl-body descendants (public article surface)
 *   2. ArticlePreview.tsx PREVIEW_CSS — .wlc-preview-body .wlc-* (editor preview)
 *
 * Single declaration here means both surfaces stay in sync automatically.
 *
 * Used by:
 *   - lib/store/mdx.tsx  renderMdxBody  (public /articles route)
 *   - components/console/ArticlePreview.tsx  (console editor preview)
 *
 * h1 in MDX is mapped to <h2 className="wlc-h2"> because the article title
 * above the body already occupies the H1 position — an h1 inside the body
 * would create a duplicate landmark and break heading hierarchy.
 *
 * Owner: Sirius (α-SUR-01) · bug-6 pagebreak/prose spacing fix
 */

import type React from 'react'

// Prop type for elements that carry children and arbitrary HTML attributes.
type ElemProps = React.HTMLAttributes<HTMLElement>

export const wlcComponents: Record<string, React.ComponentType<ElemProps>> = {
  // Paragraph
  p: (props: ElemProps) => <p className="wlc-p" {...props} />,

  // h1 in MDX body → h2 visual (H1 is already the article title above the body)
  h1: (props: ElemProps) => <h2 className="wlc-h2" {...props} />,

  // Section heading
  h2: (props: ElemProps) => <h2 className="wlc-h2" {...props} />,

  // Sub-section heading
  h3: (props: ElemProps) => <h3 className="wlc-h3" {...props} />,

  // Thematic break / pagebreak
  hr: () => <hr className="wlc-hr" />,

  // Lists
  ul: (props: ElemProps) => <ul className="wlc-ul" {...props} />,
  ol: (props: ElemProps) => <ol className="wlc-ol" {...props} />,

  // Blockquote / pullquote
  blockquote: (props: ElemProps) => <blockquote className="wlc-quote" {...props} />,

  // Inline elements — no class needed; inherit from parent or globals
  strong: (props: ElemProps) => <strong {...props} />,
  em: (props: ElemProps) => <em {...props} />,

  // Inline code
  code: (props: ElemProps) => <code className="wlc-code" {...props} />,
}
