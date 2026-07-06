import { getNode, type ArchiveNode } from "@/lib/netra/archive";

/**
 * Fixed section ids (`observer`, `channels`, `skills`, `recognition`, …)
 * are hardcoded inside lib/netra/archive.ts's own builder functions — they
 * are organizational anchors, not data derived from lib/resume-data.ts, so
 * there is no data field to read them from. `requireNode` is the guard
 * against that one remaining literal: every `data-survey`/`data-survey-
 * label` pair on this page reads its `id` and `label` from the imported
 * ArchiveNode returned here, never retyped by hand, and a typo'd or
 * removed id throws immediately at render — which fails `next build` for
 * this fully-static page. That's the closest a Server Component can get
 * to "compile-error on drift" against a non-literal id type
 * (`ARCHIVE_IDS` is `[string, ...string[]]` by design — see lib/netra/
 * archive.ts's own doc comment on why literal narrowing was traded away).
 */
export function requireNode(id: string): ArchiveNode {
  const node = getNode(id);
  if (!node) {
    throw new Error(
      `resume ledger: no archive node for id "${id}" — lib/netra/archive.ts and this component have drifted.`
    );
  }
  return node;
}
