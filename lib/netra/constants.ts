/**
 * lib/netra/constants.ts — client-safe NETRA strings.
 *
 * These are the exact, canonical strings from `lib/netra/voice.md` and
 * `docs/netra-runtime-rules.md` — quoted, not paraphrased. `prompt.ts`
 * (server-only) also draws on these so the system prompt and the client's
 * offline fallback can never disagree on wording.
 *
 * No Node APIs, no `server-only` import — this module ships in the client
 * bundle by design (the fallback path needs it when the network/API is
 * down).
 */

/** Out-of-frame refusal — companion register. voice.md §3.2 / runtime-rules.md "Out of frame". */
export const REFUSAL_OUT_OF_FRAME = "that sits outside the archive. i can't see it from here.";

/** Zero-hit search result — companion register. voice.md §2.3 / runtime-rules.md source gradient. */
export const NO_TRACE = "no trace surveyed.";

/**
 * Rate-limit / cost-ceiling dormancy pair. Instrument renders first, then the
 * companion line (register lock — instrument narrates system state, companion
 * speaks to the visitor). voice.md §3 worked example / runtime-rules.md
 * "System dormant".
 */
export const DORMANCY = {
  instrument: "α DRIFT EXCEEDED · NETRA dormant until next worldline",
  companionEn: "i need to step away from the instrument for the day. α drift has hit the ceiling.",
  companionTh: "ฉันต้องหยุดสำรวจสักพักค่ะ — วันนี้ α drift เกินเพดานแล้ว.",
} as const;
