/**
 * lib/netra/retrieval.ts — isomorphic keyword scorer over the archive.
 *
 * Exact port of the NETRA Bay prototype's `retrieve(q)` method (NETRA Bay.dc.html,
 * lines 229–241): lowercase → strip to `[a-z0-9ก-๙\s.+-]` → tokenize on
 * whitespace → keep tokens longer than 2 chars → substring-count each token
 * against `label + brief + keys` → sort descending by score.
 *
 * ONE implementation, two callers: the server tool (`search_archive` in
 * `lib/netra/tools.ts`) and the client-side offline/fallback path (network
 * down, 429, or the 6s first-token timeout). Both must return identical
 * rankings for the same query — that parity is what an eval checks.
 *
 * No Node APIs. Client-importable.
 */

import type { ArchiveNode } from "./archive";

export interface ScoredArchiveNode {
  id: string;
  node: ArchiveNode;
  score: number;
}

export function scoreArchive(query: string, nodes: readonly ArchiveNode[]): ScoredArchiveNode[] {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙\s.+-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const hits: ScoredArchiveNode[] = [];
  for (const node of nodes) {
    const hay = `${node.label} ${node.brief} ${node.keys}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (hay.indexOf(token) >= 0) score++;
    }
    if (score > 0) hits.push({ id: node.id, node, score });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits;
}
