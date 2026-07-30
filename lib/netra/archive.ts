/**
 * lib/netra/archive.ts — NETRA's surveyable archive.
 *
 * `ArchiveNode` is the unit NETRA points at, searches, and cites. `buildArchive()`
 * DERIVES every node's structural facts (id, label) from `lib/resume-data.ts` —
 * it never hardcodes a company name, a period, or a domain tag. That is the whole
 * point: add a sixth `EXPERIENCE` entry in resume-data.ts and a `file-006` node
 * appears here with zero edits to this file.
 *
 * `BRIEF_NOTES` is the one place that IS hand-curated: the flowing, numbers-in-prose
 * paragraph NETRA reads aloud when a surface is picked. It is enrichment, not
 * structure — Peat-gated (the metrics inside it are asserted true by him, not
 * computed). When a node has no entry in `BRIEF_NOTES` (e.g. a freshly-added
 * experience with no curated note yet), `buildArchive()` falls back to a brief
 * assembled mechanically from resume-data so the node is never empty.
 *
 * `channels` is the one node that does NOT read from `BRIEF_NOTES` at all — its
 * brief is built directly from `CONTACT`, which has no phone field. That makes a
 * phone-number regression structurally impossible here, independent of what
 * anyone pastes into `BRIEF_NOTES` later. Contact = email only.
 *
 * Isomorphic — no Node APIs. This module is imported by both the server (tool
 * implementations) and the client (offline/fallback retrieval), same as
 * `retrieval.ts`.
 */

import {
  CERTIFICATES,
  COLOPHON,
  CONTACT,
  DOMAIN_LABEL,
  DOMAIN_ORDER,
  DOMAIN_SHORT,
  EDUCATION,
  EXPERIENCE,
  HERO,
  LANGUAGES,
  RECOGNITION,
  SKILLS,
  WORKS,
  type Domain,
  type ExperienceEntry,
  type WorkEntry,
} from "@/lib/resume-data";

export interface ArchiveNode {
  id: string;
  label: string;
  brief: string;
  keys: string;
}

interface BriefNote {
  brief: string;
  keys: string;
}

// ── keyword helpers ──────────────────────────────────────────────────────

/** Lowercase, tokenize, dedupe — used to build `keys` when no curated note exists. */
function normalizeKeys(...parts: Array<string | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const token of part.toLowerCase().split(/[^a-z0-9ก-๙]+/)) {
      if (token.length > 1 && !seen.has(token)) {
        seen.add(token);
        out.push(token);
      }
    }
  }
  return out.join(" ");
}

// ── curated enrichment (Peat-gated) ─────────────────────────────────────
// Ported from the NETRA Bay prototype's ARCHIVE object, minus the phone
// number in `channels` (contact = email only, stripped at the source here
// rather than merely omitted downstream).

const BRIEF_NOTES: Record<string, BriefNote> = {
  observer: {
    brief:
      'the observer — krittiphong "peat" manachamni, ai engineer in bangkok (utc+7). builds production llm/rag systems end-to-end; roots in computer-vision research. reach him at krittiphong2019@gmail.com.',
    keys: "peat krittiphong manachamni who name observer bangkok thailand ai engineer about person alpha",
  },
  strata: {
    brief:
      "the strata console narrows this résumé by domain — llm/genai, ml, data/infra, vision. nothing hides; the rest only dims. keys 0–4 work too.",
    keys: "strata filter console narrow keys domain stratum",
  },
  "file-001": {
    brief:
      "file — 001 · social.plus, sep 2025 — present. the company's sole ai engineer: flagship feed ranking at p95 <500 ms / p99 <1 s @ 500 concurrent (k6-verified, <0.1% error, multi-region), a multi-tenant natural-language analytics service, daily sentiment pipelines, interest profiling, segmentation, pagerank influencer scoring.",
    keys: "social.plus socialplus current job now feed ranking p95 latency embedding pipeline analytics sentiment segmentation pagerank influencer sole only platform multi-region k6 500",
  },
  "file-002": {
    brief:
      "file — 002 · ai coach, super ai engineer season 5 (2025). coached a junior team's mri brain-tumor model (swin transformer + u-net, 2d/3d) to 1st place in the west regional final — then to the national showcase at rama 9. mentoring ran past the model, into tam/sam/som and go-to-market.",
    keys: "coach super ai engineer season 5 mri brain tumor swin unet first place regional mentor tam sam som teach",
  },
  "file-003": {
    brief:
      "file — 003 · western digital (thailand), jul — nov 2024. independently built & deployed a private rag system that cut an engineering-table setup workflow by 92%. first gen-ai adopter there — shaped the adoption strategy, presented to leadership, left with two return offers.",
    keys: "western digital wd intern rag 92 workflow time reduction return offers gen-ai adopter leadership private",
  },
  "file-004": {
    brief:
      "file — 004 · ml engineer intern, excellence center of gi oncology, chulalongkorn (2021–22). liver-ultrasound completeness model for hcc surveillance — f1 0.81, specificity 0.987 (nfnet, pytorch, captum). presented at digestive disease week 2022.",
    keys: "chulalongkorn gi oncology liver cancer hcc ultrasound f1 specificity nfnet captum ddw medical research",
  },
  "file-005": {
    brief:
      "file — 005 · research intern, ava advisory (2020). reinforcement learning — a dyna-q maze solver. the seed of the trace; first hands on the craft.",
    keys: "ava advisory reinforcement learning dyna-q maze 2020 seed first",
  },
  skills: {
    brief:
      "the rack — llm/genai (rag, fine-tuning, agent harness & loop engineering, mcp, vllm, vertex, gemini, openai, hugging face) · ml (pytorch, tensorflow, captum) · data/infra (bigquery, spanner, cloud run, docker, terraform, fastapi) · vision (ct/ultrasound) · python, sql, js/ts.",
    keys: "skills stack tools rack know technologies languages python sql javascript typescript pytorch tensorflow bigquery docker terraform fastapi mcp vllm",
  },
  "skills-llm": {
    brief:
      "llm/genai stratum — rag, llm fine-tuning, agent harness engineering, loop engineering, mcp, vllm, vertex ai, gemini, openai api, hugging face. harness engineering is the underlined one: he directs agents to production-quality systems, this page included.",
    keys: "llm genai rag fine-tuning harness loop mcp vllm vertex gemini openai hugging",
  },
  "skills-ml": {
    brief: "ml/deep stratum — pytorch, tensorflow, keras, scikit-learn, bertopic, model interpretability with captum.",
    keys: "ml deep pytorch tensorflow keras scikit bertopic captum interpretability",
  },
  "skills-data": {
    brief:
      "data/infra stratum — bigquery, cloud spanner, cloud run, cloud functions, docker, terraform, fastapi, gcp, git. the serving layer under everything at social.plus.",
    keys: "data infra bigquery spanner cloud run functions docker terraform fastapi gcp git serving",
  },
  "skills-vision": {
    brief: "vision stratum — medical imaging over ct and ultrasound, nfnet. where the research trace began.",
    keys: "vision medical imaging ct ultrasound nfnet",
  },
  "works-vault": {
    brief:
      "vault-mcp — a local graphrag mcp server (python/fastmcp) over a 500+-note obsidian vault. 522 embedded nodes, cross-modal text→image retrieval, ~150 ms/query with 0.25 ms vector search, 124 tests.",
    keys: "vault mcp personal-os graphrag obsidian notes retrieval vector project side",
  },
  "works-farm": {
    brief:
      "billion farm erp — end-to-end erp for a family broiler farm (next.js/typescript, supabase, 39-table multi-tenant rls), run from the field via a line bot. a gemini vision layer scores photo-proof of work 0–1; low scores route to human review — fail-safe by design.",
    keys: "billion farm erp broiler line bot supabase rls gemini vision photo proof family project",
  },
  "works-worldline": {
    brief:
      "worldline — this surface. designed & engineered end-to-end by one engineer directing an agent harness to designer-quality ui; taste-led, not templated. the résumé you are reading is itself the system-design sample.",
    keys: "worldline this site surface website design harness who built made atlas meta",
  },
  "works-namfon": {
    brief: "namfon ai (2025) — a self-initiated reasoning thai llm side-project. still growing.",
    keys: "namfon thai llm reasoning side project",
  },
  "works-hashtag": {
    brief: "hashtag: ai news agency (2021–22) — de-biasing news + daily summaries, backed by a ted fund grant of 100,000 thb.",
    keys: "hashtag news agency bias summaries ted fund grant 100000 thb",
  },
  recognition: {
    brief:
      "recognition — silver medal, super ai engineer s1 (1 of 19 advanced awardees from 2,000+ nationwide) · ted fund grant, 100,000 thb · aws build on asean finalist · sustainability expo 2022 finalist & pitcher · jstp #22 scholar.",
    keys: "award recognition medal silver honor prize finalist scholar jstp ted aws standing",
  },
  origin: {
    brief:
      "origin — b.eng environmental engineering, chulalongkorn university (2020–2024), and mahidol wittayanusorn (mwit), the science-gifted school (2017–2020). the engineering came first; the ai was self-surveyed.",
    keys: "education degree university school chulalongkorn mwit environmental engineering study origin",
  },
  languages: {
    brief: "languages — thai, native. english, professional: toeic 810, used daily across global teams; u.s. j-1 work & travel, 2022.",
    keys: "language thai english toeic speak communication j-1",
  },
  certificates: {
    brief:
      "certificates — generative ai with llms (deeplearning.ai) · image classification with tensorflow on google cloud · gati8, chula × tokyo tech (2023) · shopee code league 2022.",
    keys: "certificate course deeplearning tensorflow gati shopee",
  },
  colophon: {
    brief:
      "the colophon — this résumé and the worldline around it were designed & engineered end-to-end by the observer, directing an agent harness. no template. read the page itself as evidence of system design.",
    keys: "colophon built how made harness engineered template system design architecture himself",
  },
};

// ── node builders — one per resume-data section ─────────────────────────

function buildObserverNode(): ArchiveNode {
  const id = "observer";
  const label = `OBSERVER α · ${HERO.firstName.toUpperCase()} "${HERO.nickname.toUpperCase()}"`;
  const note = BRIEF_NOTES[id];
  const brief =
    note?.brief ??
    `the observer — ${HERO.firstName.toLowerCase()} "${HERO.nickname.toLowerCase()}" ${HERO.lastName.toLowerCase()}, ${HERO.title.toLowerCase()}. reach him at ${CONTACT.email}.`;
  const keys = note?.keys ?? normalizeKeys(HERO.firstName, HERO.nickname, HERO.lastName, HERO.title, "observer alpha who name about person");
  return { id, label, brief, keys };
}

/**
 * The one node that never reads BRIEF_NOTES. Built entirely from CONTACT,
 * which has no phone field — so a phone number cannot leak back in here
 * regardless of what gets pasted into BRIEF_NOTES in the future.
 */
function buildChannelsNode(): ArchiveNode {
  const id = "channels";
  const label = "CHANNELS // TRANSMIT";
  const linkList = CONTACT.links.map((l) => l.label).join(" · ");
  const brief = `channels — ${CONTACT.email} · ${linkList}. the fastest signal is email.`;
  const keys = normalizeKeys("contact email reach hire transmit channel resume", ...CONTACT.links.map((l) => l.id));
  return { id, label, brief, keys };
}

function buildStrataNode(): ArchiveNode {
  const id = "strata";
  const label = "STRATA CONSOLE";
  const domainList = DOMAIN_ORDER.map((d) => DOMAIN_LABEL[d].toLowerCase()).join(", ");
  const note = BRIEF_NOTES[id];
  const brief = note?.brief ?? `the strata console narrows this résumé by domain — ${domainList}. nothing hides; the rest only dims. keys 0–4 work too.`;
  const keys = note?.keys ?? normalizeKeys("strata filter console narrow keys domain stratum", domainList);
  return { id, label, brief, keys };
}

function fileId(index: number): string {
  return `file-${String(index + 1).padStart(3, "0")}`;
}

function fallbackFileBrief(entry: ExperienceEntry, index: number): string {
  const nnn = fileId(index).replace("file-", "");
  const kr = entry.keyResult ? ` key result — ${entry.keyResult.value}.` : "";
  return `file — ${nnn} · ${entry.role.toLowerCase()}, ${entry.company.toLowerCase()}, ${entry.period.toLowerCase()}.${kr} ${entry.bullets.join(" ")}`.trim();
}

function buildFileNodes(): ArchiveNode[] {
  return EXPERIENCE.map((entry, index) => {
    const id = fileId(index);
    const label = `FILE — ${id.replace("file-", "")} · ${(entry.shortName ?? entry.company).toUpperCase()}`;
    const note = BRIEF_NOTES[id];
    const brief = note?.brief ?? fallbackFileBrief(entry, index);
    const keys =
      note?.keys ??
      normalizeKeys(entry.company, entry.shortName, entry.role, entry.location, id, ...entry.domains);
    return { id, label, brief, keys };
  });
}

function buildSkillsSummaryNode(): ArchiveNode {
  const id = "skills";
  const label = "SKILLS // INSTRUMENT RACK";
  const note = BRIEF_NOTES[id];
  const brief = note?.brief ?? `the rack — ${SKILLS.map((g) => `${g.label.toLowerCase()} (${g.items.toLowerCase()})`).join(" · ")}.`;
  const keys = note?.keys ?? normalizeKeys(...SKILLS.map((g) => `${g.label} ${g.items}`));
  return { id, label, brief, keys };
}

function buildSkillsNodes(): ArchiveNode[] {
  // Only single-domain groups get their own surveyable surface — the
  // cross-domain "Code" row isn't a `data-survey` target on the page.
  return SKILLS.filter((g) => g.domains.length === 1).map((group) => {
    const domain = group.domains[0];
    const id = `skills-${domain}`;
    const label = `SKILLS · ${group.label.toUpperCase()}`;
    const note = BRIEF_NOTES[id];
    const brief = note?.brief ?? `${group.label.toLowerCase()} stratum — ${group.items.toLowerCase()}.`;
    const keys = note?.keys ?? normalizeKeys(group.label, group.items, domain);
    return { id, label, brief, keys };
  });
}

function fallbackWorkBrief(work: WorkEntry): string {
  const metrics = work.metrics?.length ? ` ${work.metrics.join(" · ")}.` : "";
  const grant = work.grant ? ` ${work.grant}.` : "";
  return `${work.name.toLowerCase()} — ${work.desc.toLowerCase()}${metrics}${grant}`.trim();
}

function buildWorksNodes(): ArchiveNode[] {
  return WORKS.map((work) => {
    const id = work.id;
    const label = `${work.isAlpha ? "α TRACE — " : "TRACE — "}${work.shortName}`;
    const note = BRIEF_NOTES[id];
    const brief = note?.brief ?? fallbackWorkBrief(work);
    const keys = note?.keys ?? normalizeKeys(work.name, work.desc, work.shortName, ...work.domains);
    return { id, label, brief, keys };
  });
}

function buildRecognitionNode(): ArchiveNode {
  const id = "recognition";
  const label = "RECOGNITION";
  const note = BRIEF_NOTES[id];
  const brief =
    note?.brief ??
    `recognition — ${RECOGNITION.map((r) => r.title.toLowerCase() + (r.detail ? ` (${r.detail.toLowerCase()})` : "")).join(" · ")}.`;
  const keys = note?.keys ?? normalizeKeys("award recognition medal honor prize finalist scholar standing", ...RECOGNITION.map((r) => r.title));
  return { id, label, brief, keys };
}

function buildOriginNode(): ArchiveNode {
  const id = "origin";
  const label = "ORIGIN";
  const note = BRIEF_NOTES[id];
  const brief =
    note?.brief ??
    `origin — ${EDUCATION.map((e) => `${e.program.toLowerCase()}, ${e.institution.toLowerCase()} (${e.period.toLowerCase()})`).join("; and ")}.`;
  const keys = note?.keys ?? normalizeKeys("education degree university school origin study", ...EDUCATION.map((e) => `${e.program} ${e.institution}`));
  return { id, label, brief, keys };
}

function buildLanguagesNode(): ArchiveNode {
  const id = "languages";
  const label = "LANGUAGES";
  const note = BRIEF_NOTES[id];
  const brief =
    note?.brief ??
    `languages — ${LANGUAGES.map((l) => `${l.name.toLowerCase()}, ${l.level.toLowerCase()}${l.detail ? ` (${l.detail.toLowerCase()})` : ""}`).join(". ")}.`;
  const keys = note?.keys ?? normalizeKeys("language speak communication", ...LANGUAGES.map((l) => l.name));
  return { id, label, brief, keys };
}

function buildCertificatesNode(): ArchiveNode {
  const id = "certificates";
  const label = "CERTIFICATES";
  const note = BRIEF_NOTES[id];
  const brief = note?.brief ?? `certificates — ${CERTIFICATES.map((c) => c.toLowerCase()).join(" · ")}.`;
  const keys = note?.keys ?? normalizeKeys("certificate course", ...CERTIFICATES);
  return { id, label, brief, keys };
}

function buildColophonNode(): ArchiveNode {
  const id = "colophon";
  const label = "COLOPHON // THIS SURFACE";
  const note = BRIEF_NOTES[id];
  const brief = note?.brief ?? `the colophon — ${COLOPHON.text}`;
  const keys = note?.keys ?? normalizeKeys("colophon built how made harness engineered template system design architecture himself", ...COLOPHON.stack);
  return { id, label, brief, keys };
}

// ── assembly ─────────────────────────────────────────────────────────────

export function buildArchive(): ArchiveNode[] {
  return [
    buildObserverNode(),
    buildChannelsNode(),
    buildStrataNode(),
    ...buildFileNodes(),
    buildSkillsSummaryNode(),
    ...buildSkillsNodes(),
    ...buildWorksNodes(),
    buildRecognitionNode(),
    buildOriginNode(),
    buildLanguagesNode(),
    buildCertificatesNode(),
    buildColophonNode(),
  ];
}

export const ARCHIVE: ArchiveNode[] = buildArchive();

/**
 * Non-empty tuple for `z.enum(ARCHIVE_IDS)` in `lib/netra/tools.ts`. Cast
 * (not a literal-per-element tuple) because the ids are computed from
 * resume-data at module-eval time — that's the tradeoff for "a sixth role
 * needs zero archive edits." Runtime validation is exact either way; only
 * compile-time literal narrowing is given up.
 */
export const ARCHIVE_IDS = ARCHIVE.map((n) => n.id) as [string, ...string[]];

/** Total surveyable surfaces. NOT hardcoded — this is the fix for the prototype's stale "19 SURFACES" (actually 23). */
export const SURFACE_COUNT = ARCHIVE.length;

const ARCHIVE_BY_ID = new Map(ARCHIVE.map((n) => [n.id, n] as const));

export function getNode(id: string): ArchiveNode | undefined {
  return ARCHIVE_BY_ID.get(id);
}

// ── strata readout (NETRA bay RANGE/RETICLE pair) ───────────────────────

export type StratumId = "all" | Domain;

export const STRATUM_ORDER: readonly StratumId[] = ["all", ...DOMAIN_ORDER];

/**
 * Per-stratum trace count, counted over EXPERIENCE (the "file" dossiers) —
 * the same set the strata console's `◎ ALL` pill count is drawn from.
 * Computed, not curated: the prototype hardcoded `03 TRACES · ML` when the
 * true count is 4 (file-001, file-002, file-004, file-005 all tag `ml`).
 * That class of bug — a hand-typed number outliving the data it described —
 * cannot recur here because there's no number to hand-type.
 */
export function strataCounts(): Record<StratumId, number> {
  const counts = { all: EXPERIENCE.length, llm: 0, ml: 0, data: 0, vision: 0 } as Record<StratumId, number>;
  for (const entry of EXPERIENCE) {
    for (const domain of entry.domains) {
      counts[domain] += 1;
    }
  }
  return counts;
}

export interface StratumReadout {
  range: string;
  ret: string;
}

/** Bearing/reference readout per stratum. Not a count — a curated instrument descriptor (geo bearing, representative stack token). */
const STRATUM_RET: Record<StratumId, string> = {
  all: "13.75°N",
  llm: "PROD · RAG",
  ml: "PyTorch",
  data: "GCP",
  vision: "CT / US",
};

export const STRATA_READOUT: Record<StratumId, StratumReadout> = (() => {
  const counts = strataCounts();
  const readout = {} as Record<StratumId, StratumReadout>;
  readout.all = { range: `${SURFACE_COUNT} SURFACES`, ret: STRATUM_RET.all };
  for (const domain of DOMAIN_ORDER) {
    const n = counts[domain];
    const word = n === 1 ? "TRACE" : "TRACES";
    readout[domain] = {
      range: `${String(n).padStart(2, "0")} ${word} · ${DOMAIN_SHORT[domain]}`,
      ret: STRATUM_RET[domain],
    };
  }
  return readout;
})();
