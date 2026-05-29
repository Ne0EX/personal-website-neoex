/**
 * Pullquote
 * ---------
 * Inline MDX component for a typographically styled pull quote on the
 * article reading surface.
 *
 * ## Usage
 *
 * ```mdx
 * <Pullquote>
 *   the cleanest definition of taste is repeated exposure to careful work.
 * </Pullquote>
 *
 * <Pullquote source="W. McAskill, *What We Owe the Future*">
 *   the cleanest definition of taste is repeated exposure to careful work.
 * </Pullquote>
 * ```
 *
 * ## Rendering contract (for Sirius — α-SUR-01)
 *
 * The quote body renders as:
 *   - Cormorant Garamond italic, 24px, line-height 1.3
 *   - `padding-left: 32px`
 *   - left hairline: `1px solid var(--accent-orange)`
 *   - color: `var(--ink-primary)`
 *   - Per `docs/design/09-article-entry.md` §typography/pullquote
 *
 * The `source` prop (when present) renders below the quote body as:
 *   - JetBrains Mono (`var(--font-mono)`), 11px desktop / 10px mobile
 *   - color: `var(--ink-soft)`
 *   - em-dash prefix: `— {source}`
 *   - `margin-top: var(--space-2)` (gap between quote and attribution)
 *   - Markdown in `source` (e.g. `*italics*`) should be rendered —
 *     pass the value through a lightweight inline MDX/markdown renderer
 *     or render as dangerouslySetInnerHTML with sanitization.
 *     Restrict allowed tags to: <em>, <strong>, <cite>.
 *   - NOT italic by default (the em-dash attribution line is mono, instrument register)
 *
 * Accessibility: wrap the outer element in `<blockquote>`. If `source` is
 * present, wrap it in `<cite>` and connect via `aria-describedby` or place it
 * as a direct child of `<blockquote>` per WHATWG spec.
 *
 * Owner: Sirius (α-SUR-01) renders this. Procyon owns this interface.
 */
export interface PullquoteProps {
  /**
   * The quote body. Rendered as children — supports inline MDX/JSX.
   * Wrap long quotes at ~60ch for best typographic fit on 70ch body column.
   */
  children: React.ReactNode

  /**
   * Optional attribution line displayed below the quote.
   *
   * Accepts a plain string. Markdown-style inline formatting (e.g. *italics*)
   * is permitted and should be rendered by Sirius's implementation.
   *
   * Rendering spec:
   *   - Prefix with em-dash: "— {source}"
   *   - JetBrains Mono · 11px desktop / 10px mobile
   *   - color: `var(--ink-soft)`
   *   - margin-top: `var(--space-2)`
   *
   * Examples:
   *   source="W. McAskill, *What We Owe the Future*"
   *   source="Peat, field notes 2026.04.15"
   */
  source?: string
}

/**
 * Pullquote component.
 *
 * Rendering JSX is Sirius's (α-SUR-01) responsibility.
 * This file defines the prop contract only.
 *
 * @see PullquoteProps
 * @see docs/design/09-article-entry.md — §typography/pullquote + §tokens used
 */
export declare function Pullquote(props: PullquoteProps): React.ReactElement
