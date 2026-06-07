/**
 * components/console/console-types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared types for the Atlas Console front door (Slice 2).
 *
 * ConsoleNode is the runtime node object: velite metadata mapped to a canvas
 * node with synthesized x,y positions (deterministic grid layout).
 * The prototype's `kind` values from console-data.js are the authoritative
 * source for glyph / color / role.
 *
 * Owner: Sirius (α-SUR-01) · atlas-console Slice 2
 */

/** Authoring-surface node kinds (article, photo, fiction from velite + repo future). */
export type NodeKind = 'article' | 'photo' | 'fiction' | 'repo'

/** One node on the console canvas. */
export interface ConsoleNode {
  id:      string     // unique in-session id, e.g. "article-003"
  kind:    NodeKind
  /**
   * File identifier used in the OPEN EDITOR URL contract.
   * article → fileNum ("003"), fiction → slug, photo → roll/id.
   */
  fileId:  string
  title:   string
  date:    string     // display date YYYY.MM.DD
  domain:  string
  tags:    string[]
  summary: string
  /** World-space canvas position (top-left of card, px). */
  x:       number
  y:       number
}

/** One directed edge between two nodes. */
export interface ConsoleEdge {
  id:     string
  source: string   // node id
  target: string   // node id
  label:  string
}

/** Form data while editing a node (kind-tagged for select control). */
export interface ConsoleFormData {
  id:      string
  kind:    NodeKind
  fileId:  string
  title:   string
  date:    string
  domain:  string
  tags:    string[]
  summary: string
  x:       number
  y:       number
}

/** Kind → glyph / role / color metadata. Mirrors console-data.js `kinds`. */
export const KINDS: Record<NodeKind, { glyph: string; role: string; color: string }> = {
  article: { glyph: '◆', role: 'SURVEYED RECORD',  color: 'var(--ink-primary)' },
  photo:   { glyph: '◎', role: 'OPTICAL TRACE',    color: 'var(--accent-orange)' },
  fiction: { glyph: '△', role: 'POSSIBILITY SHELL', color: 'var(--ink-primary)' },
  repo:    { glyph: '○', role: 'SOURCE LOCUS',      color: 'var(--ink-faint)' },
}
