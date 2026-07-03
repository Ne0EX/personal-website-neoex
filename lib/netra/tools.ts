/**
 * lib/netra/tools.ts — NETRA's two AI SDK v6 tools for the résumé surface.
 *
 * Exactly two tools, matching the redesign plan's Part A / Procyon's S3
 * return contract:
 *
 *   search_archive({ query, limit }) → { count, ms, nodes }
 *     Keyword search over the whole archive via `scoreArchive` (the same
 *     isomorphic scorer the client-side offline fallback uses — server and
 *     fallback can never disagree on ranking). `count` is the TOTAL number
 *     of hits (honest, even when `nodes` is truncated to `limit`); `ms` is
 *     a real measured duration, never a fabricated number; `nodes` carries
 *     only `{id, label, brief}` — never the internal `keys` field, which
 *     exists purely for scoring.
 *
 *   inspect_surface({ id }) → { id, label, brief }
 *     Single-surface lookup. `id` is `z.enum(ARCHIVE_IDS)` — a schema-level
 *     whitelist, so the model can only ever name a surface that actually
 *     exists. Per Procyon's note: because `ARCHIVE_IDS` is computed from
 *     `lib/resume-data.ts` at module-eval time (not a hand-written literal
 *     tuple), TypeScript infers the enum's value type as plain `string`
 *     rather than a literal union — runtime validation is exact either
 *     way; only compile-time literal narrowing is traded away, in exchange
 *     for "a sixth EXPERIENCE/WORKS entry needs zero edits to tools.ts."
 *
 * Both tools return only what the archive itself already holds — no tool
 * result is ever assembled from live visitor input, so a tool output can
 * never become a vector for injecting attacker-controlled text into the
 * model's context under the guise of "archive data" (see the injection
 * fence in lib/netra/prompt.ts).
 */

import { z } from "zod";
import { tool } from "ai";

import { ARCHIVE, ARCHIVE_IDS, getNode } from "./archive";
import { scoreArchive } from "./retrieval";

export const searchArchiveTool = tool({
  description:
    "search the surveyed résumé archive (experience dossiers, skills, works, recognition, origin, contact) by keyword. returns an honest hit count and the top-scoring surfaces only — never invents an entry that isn't in the archive.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(200)
      .describe("keyword or short phrase to search the archive for, e.g. \"rag latency\" or \"medical imaging\""),
    limit: z
      .number()
      .int()
      .min(1)
      .max(5)
      .default(3)
      .describe("maximum number of matching surfaces to return (the reported count is never truncated to this)"),
  }),
  execute: async ({ query, limit }) => {
    const t0 = performance.now();
    const hits = scoreArchive(query, ARCHIVE);
    const ms = Math.max(1, Math.round(performance.now() - t0));
    return {
      count: hits.length,
      ms,
      nodes: hits.slice(0, limit).map((hit) => ({
        id: hit.node.id,
        label: hit.node.label,
        brief: hit.node.brief,
      })),
    };
  },
});

export const inspectSurfaceTool = tool({
  description:
    "inspect a single surveyed surface of the résumé archive by its exact archive id (e.g. \"file-003\", \"skills-llm\", \"works-worldline\", \"channels\") — returns its label and full brief.",
  inputSchema: z.object({
    id: z.enum(ARCHIVE_IDS).describe("the archive id of the surface to inspect"),
  }),
  execute: async ({ id }) => {
    const node = getNode(id);
    // z.enum(ARCHIVE_IDS) already guarantees `id` names a real node — this
    // branch exists only as a defensive fallback, never expected to run.
    if (!node) {
      return { id, label: "UNSURVEYED", brief: "no trace surveyed." };
    }
    return { id: node.id, label: node.label, brief: node.brief };
  },
});

/** Wired into `streamText({ tools: netraTools })` by the /api/chat route (S4). */
export const netraTools = {
  search_archive: searchArchiveTool,
  inspect_surface: inspectSurfaceTool,
};
