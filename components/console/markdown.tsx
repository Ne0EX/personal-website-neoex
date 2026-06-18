/**
 * components/console/markdown.tsx — Worldline Article Editor · Markdown Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Ported from the prototype's editor-engine.jsx (parseMarkdown@43, renderInline@77,
 * Blocks@93). TypeScript-typed discriminated union.
 *
 * Rule: body blocks are styled by an embedded scoped <style> block in
 * ArticlePreview (the only consumer). The class names mirror the prototype's
 * .ep-* classes, scoped under .wlc-preview-body to avoid globals.css collisions.
 * Raw literal values (px/opacity tints) that globals.css has no token for are
 * collected as TOKEN-GAP comments for Betelgeuse.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 1
 * Prototype: /tmp/wl-design-extracted/atlas-console/project/console/editor-engine.jsx
 */

import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Block types (discriminated union — keeps Blocks' render exhaustive)
// ─────────────────────────────────────────────────────────────────────────────

export type HeadingBlock = { type: 'h2' | 'h3'; text: string }
export type HrBlock     = { type: 'hr' }
export type QuoteBlock  = { type: 'quote'; text: string }
export type UlBlock     = { type: 'ul'; items: string[] }
export type ImgBlock    = { type: 'img'; alt: string; src: string }
export type PBlock      = { type: 'p'; text: string }

export type Block =
  | HeadingBlock
  | HrBlock
  | QuoteBlock
  | UlBlock
  | ImgBlock
  | PBlock

// ─────────────────────────────────────────────────────────────────────────────
// parseMarkdown — markdown subset → Block[]
// Ported from prototype editor-engine.jsx@43.
// ─────────────────────────────────────────────────────────────────────────────

export function parseMarkdown(md: string): Block[] {
  const lines = (md || '').replace(/\r/g, '').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const ln = lines[i]
    if (!ln.trim()) { i++; continue }
    if (ln.startsWith('### ')) { blocks.push({ type: 'h3', text: ln.slice(4) }); i++; continue }
    if (ln.startsWith('## '))  { blocks.push({ type: 'h2', text: ln.slice(3) }); i++; continue }
    if (ln.startsWith('# '))   { blocks.push({ type: 'h2', text: ln.slice(2) }); i++; continue }
    if (/^---+\s*$/.test(ln))  { blocks.push({ type: 'hr' }); i++; continue }
    if (ln.startsWith('> ')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++ }
      blocks.push({ type: 'quote', text: buf.join(' ') })
      continue
    }
    if (/^!\[.*\]\(.*\)/.test(ln)) {
      const m = ln.match(/^!\[(.*)\]\((.*)\)/)
      if (m) blocks.push({ type: 'img', alt: m[1], src: m[2] })
      i++; continue
    }
    if (/^[-*] /.test(ln)) {
      const items: string[] = []
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(lines[i].slice(2)); i++ }
      blocks.push({ type: 'ul', items })
      continue
    }
    // paragraph — gather contiguous non-blank, non-special lines
    const buf: string[] = [ln]; i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,3} |> |- |\* |---)/.test(lines[i])) {
      buf.push(lines[i]); i++
    }
    blocks.push({ type: 'p', text: buf.join(' ') })
  }
  return blocks
}

// ─────────────────────────────────────────────────────────────────────────────
// renderInline — **bold** *italic* `code` → React nodes
// Ported from prototype editor-engine.jsx@77.
// ─────────────────────────────────────────────────────────────────────────────

export function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**'))
      out.push(<strong key={keyPrefix + 'b' + k}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`'))
      out.push(<code key={keyPrefix + 'c' + k} className="wlc-code">{tok.slice(1, -1)}</code>)
    else
      out.push(<em key={keyPrefix + 'i' + k}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length; k++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// slugify — heading text → DOM-safe id (mirrors scrollToHeading in EntryEditor)
// Used by Blocks so outline click-scroll resolves ids in the preview pane.
// Public-page note: ArticleEntry uses renderMdxBody, NOT Blocks — this function
// is console-preview-only; the public /articles/[fileNum] page is unaffected.
// ─────────────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocks — render a Block[] as React nodes (no wrapping div — caller decides)
// Ported from prototype editor-engine.jsx@93.
// Class names use .wlc-* scope (styled in ArticlePreview's embedded <style>).
// heading ids: slugified heading text so scrollToHeading in ArticleOutline can
// querySelector('#slug') inside the preview pane (ed-preview). Inert on the
// public page (ArticleEntry renders via renderMdxBody, never Blocks).
// ─────────────────────────────────────────────────────────────────────────────

export function Blocks({ blocks }: { blocks: Block[] }): React.ReactNode {
  return blocks.map((b, i) => {
    const key = 'blk' + i
    if (b.type === 'h2') return <h2 key={key} id={slugify(b.text)} className="wlc-h2">{renderInline(b.text, key)}</h2>
    if (b.type === 'h3') return <h3 key={key} id={slugify(b.text)} className="wlc-h3">{renderInline(b.text, key)}</h3>
    if (b.type === 'hr') return <hr key={key} className="wlc-hr" />
    if (b.type === 'quote') return (
      <blockquote key={key} className="wlc-quote">
        <span className="wlc-quote-mark" aria-hidden>&#x201C;</span>
        {renderInline(b.text, key)}
      </blockquote>
    )
    if (b.type === 'ul') return (
      <ul key={key} className="wlc-ul">
        {b.items.map((it, j) => (
          <li key={key + 'li' + j}>{renderInline(it, key + j)}</li>
        ))}
      </ul>
    )
    if (b.type === 'img') return (
      <figure key={key} className="wlc-figure">
        {/* IMAGE SLOT — placeholder; src is present for future <img> wire-up */}
        <div className="wlc-img-slot" aria-label={b.alt || 'image placeholder'}>
          <span>◎ {b.alt || 'image'}</span>
        </div>
      </figure>
    )
    // paragraph — b.type === 'p'
    return <p key={key} className="wlc-p">{renderInline(b.text, key)}</p>
  })
}
