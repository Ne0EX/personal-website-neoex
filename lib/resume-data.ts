/**
 * lib/resume-data.ts — single source of truth for the NETRA Survey ledger
 * (resume.neoex.dev, root `/`).
 *
 * Ported + extended from `app/resume/resume-data.ts` (S2 / PRD "resume redesign").
 * The old file stays in place until S5 retires `app/resume/`.
 *
 * Every render-facing fact for the page lives here: hero, experience dossiers
 * (with KEY RESULT margin data + expandable "full trace" bullets), skills
 * groups, selected works (flagship cards + inline traces), recognition,
 * origin/education, languages, certificates, colophon, and contact.
 *
 * `lib/netra/archive.ts` DERIVES its ArchiveNode set from these exports —
 * do not duplicate structural facts (company, period, domains, metrics) in
 * the archive layer. Add a field here first; the archive reads it.
 *
 * CONTACT IS EMAIL ONLY. There is no phone field anywhere in this module —
 * that is intentional and load-bearing (see project decision: contact =
 * email only, phone stripped everywhere). Do not add one back.
 */

// ── domain taxonomy ──────────────────────────────────────────────────────

/** Strata domain tag. Every experience entry, skill group, and work carries one or more. */
export type Domain = "llm" | "ml" | "data" | "vision";

/** Long form — used on the strata console pills (`◇ LLM / GENAI`). */
export const DOMAIN_LABEL: Record<Domain, string> = {
  llm: "LLM / GENAI",
  ml: "ML / DEEP",
  data: "DATA / INFRA",
  vision: "VISION",
};

/** Short form — used on the NETRA bay range readout (`02 TRACES · LLM`). */
export const DOMAIN_SHORT: Record<Domain, string> = {
  llm: "LLM",
  ml: "ML",
  data: "DATA",
  vision: "VISION",
};

/** Strata pill glyph. */
export const DOMAIN_GLYPH: Record<Domain, string> = {
  llm: "◇",
  ml: "○",
  data: "△",
  vision: "◆",
};

export const DOMAIN_ORDER: readonly Domain[] = ["llm", "ml", "data", "vision"];

// ── shared shapes ────────────────────────────────────────────────────────

export interface Coords {
  lat: number;
  lon: number;
}

export type Lifecycle = "ongoing" | "settled" | "refined" | "seed";

export const LIFECYCLE_META: Record<Lifecycle, { glyph: string; label: string }> = {
  ongoing: { glyph: "◎", label: "ONGOING" },
  settled: { glyph: "◆", label: "SETTLED" },
  refined: { glyph: "◇", label: "REFINED" },
  seed: { glyph: "○", label: "SEED" },
};

/** The orange-bordered margin callout on each dossier (`KEY RESULT`). */
export interface KeyResult {
  value: string; // "p95 <500 ms"
  detail: string[]; // ["FEED RANKING · 500 CCU", "<0.1% ERR · MULTI-REGION"]
}

// ── hero ─────────────────────────────────────────────────────────────────

export interface Hero {
  firstName: string;
  nickname: string;
  lastName: string;
  title: string; // "AI Engineer — Production LLM / RAG Systems · Bangkok, Thailand"
  lede: string;
  coords: Coords;
  surveyedOn: string; // "Jul 2026"
  lifecycle: Lifecycle;
}

export const HERO: Hero = {
  firstName: "Krittiphong",
  nickname: "Peat",
  lastName: "Manachamni",
  title: "AI Engineer — Production LLM / RAG Systems · Bangkok, Thailand",
  lede:
    "i build production LLM/RAG systems that ship — data pipelines to low-latency, multi-region serving, running daily across global teams. rooted in computer-vision & NLP research: medical imaging, liver-cancer diagnostics.",
  coords: { lat: 13.7563, lon: 100.5018 },
  surveyedOn: "Jul 2026",
  lifecycle: "ongoing",
};

// ── contact — email only, no phone ──────────────────────────────────────

export interface ContactLink {
  id: "github" | "linkedin" | "site";
  label: string;
  href: string;
}

export interface Contact {
  email: string;
  emailHref: string;
  links: ContactLink[];
}

export const CONTACT: Contact = {
  email: "krittiphong2019@gmail.com",
  emailHref: "mailto:krittiphong2019@gmail.com",
  links: [
    { id: "github", label: "github.com/Ne0EX", href: "https://github.com/Ne0EX" },
    {
      id: "linkedin",
      label: "linkedin / krittiphong-manachamni",
      href: "https://linkedin.com/in/krittiphong-manachamni",
    },
    { id: "site", label: "neoex.dev", href: "https://neoex.dev" },
  ],
};

// ── experience ───────────────────────────────────────────────────────────

export interface ExperienceEntry {
  /** Archive label override when `company` isn't the compact form (e.g. "Super AI Engineer S5"). */
  shortName?: string;
  company: string;
  /** Secondary line under company — team note or institution. */
  subtitle?: string;
  role: string;
  location: string;
  period: string;
  coords: Coords;
  isCurrent: boolean;
  lifecycle: Lifecycle;
  domains: Domain[];
  /** Italic subline shown under the role (only social.plus has one). */
  lede?: string;
  bullets: string[];
  /** Bullets revealed by "SURVEY FULL TRACE" — omitted when there's nothing to expand. */
  extraBullets?: string[];
  keyResult?: KeyResult;
}

export const EXPERIENCE: ExperienceEntry[] = [
  {
    company: "social.plus",
    subtitle: "Platform Team — the company's sole AI engineer",
    role: "AI Engineer",
    location: "Bangkok, Thailand",
    period: "Sep 2025 – Present",
    coords: { lat: 13.7563, lon: 100.5018 },
    isCurrent: true,
    lifecycle: "ongoing",
    domains: ["llm", "data", "ml"],
    lede: "own the data & AI side of features end-to-end — partnering backend, SDK, QA & DevOps.",
    bullets: [
      "Built the AI/data layer of the flagship personalized feed-ranking system — post-scoring + embedding pipeline load-tested to p95 <500 ms / p99 <1 s at 500 concurrent users, <0.1% error (k6-verified), serving multiple regions.",
      "Designed & shipped a multi-tenant, read-only natural-language analytics service — customers query their own data in plain English, with strict per-tenant isolation.",
      "Built the data & AI pipeline for daily sentiment + keyword analysis over social threads — cost-efficient batch inference across production regions, with on-demand historical re-analysis and full job tracking.",
    ],
    extraBullets: [
      "Per-user interest profiling powering personalization — top-5 ranked interests per user on a weekly refresh over a 30-day activity window.",
      "Audience segmentation into interpretable, business-labeled segments — LLM-labeled clusters across multiple regions.",
      "Graph-topology influencer ranking replacing the follower-count proxy with engagement-graph PageRank — 0–100 daily scores, separate comment / reaction influence.",
    ],
    keyResult: {
      value: "p95 <500 ms",
      detail: ["FEED RANKING · 500 CCU", "<0.1% ERR · MULTI-REGION"],
    },
  },
  {
    shortName: "Super AI Engineer S5",
    company: "Super AI Engineer — Season 5",
    subtitle: "AI Innovator Track",
    role: "AI Coach",
    location: "Thailand",
    period: "Jun – Oct 2025",
    coords: { lat: 15.87, lon: 100.9925 },
    isCurrent: false,
    lifecycle: "settled",
    domains: ["vision", "ml"],
    bullets: [
      "Coached a junior team building an MRI brain-tumor detection & segmentation model (Swin Transformer + U-Net, 2D/3D) to 1st place in the West regional final — selected for the national showcase (Rama 9, Oct 2025).",
      "Mentored beyond the model — market validation (TAM / SAM / SOM) and go-to-market thinking, shaping a market-ready innovation.",
    ],
    keyResult: {
      value: "1st place",
      detail: ["WEST REGIONAL FINAL", "NATIONAL SHOWCASE — RAMA 9"],
    },
  },
  {
    shortName: "Western Digital",
    company: "Western Digital (Thailand)",
    role: "AI Engineer Intern",
    location: "Bang Pa-In, Thailand",
    period: "Jul – Nov 2024",
    coords: { lat: 14.23, lon: 100.58 },
    isCurrent: false,
    lifecycle: "settled",
    domains: ["llm"],
    bullets: [
      "Cut an engineering-table setup workflow by 92% — independently built and deployed a private RAG system.",
      "First Gen-AI adopter at the company — influenced its Gen-AI adoption strategy and presented technical insight to leadership.",
      "Earned two return offers on the strength of the internship. Stack: RAG · Hugging Face · OpenAI API · PyTorch.",
    ],
    keyResult: {
      value: "92%",
      detail: ["TIME REDUCTION — PRIVATE RAG", "TWO RETURN OFFERS"],
    },
  },
  {
    shortName: "GI Oncology, Chula",
    company: "Excellence Center of GI Oncology",
    subtitle: "Chulalongkorn University",
    role: "ML Engineer Intern",
    location: "Bangkok, Thailand",
    period: "Mar 2021 – Apr 2022",
    coords: { lat: 13.7367, lon: 100.5232 },
    isCurrent: false,
    lifecycle: "refined",
    domains: ["vision", "ml"],
    bullets: [
      "Achieved F1 0.81 and specificity 0.987 for HCC (liver-cancer) surveillance — a liver-ultrasound completeness model (NFNet in PyTorch, Captum interpretability).",
      "Work presented at Digestive Disease Week (DDW) 2022.",
    ],
    keyResult: {
      value: "F1 0.81",
      detail: ["SPECIFICITY 0.987", "DDW 2022"],
    },
  },
  {
    company: "AVA Advisory",
    role: "Research Intern",
    location: "Bangkok, Thailand",
    period: "Jun – Jul 2020",
    coords: { lat: 13.7437, lon: 100.5488 },
    isCurrent: false,
    lifecycle: "seed",
    domains: ["ml"],
    bullets: ["Reinforcement learning — built a Dyna-Q maze solver. First hands on the craft."],
  },
];

// ── skills ───────────────────────────────────────────────────────────────

export interface SkillGroup {
  id: string; // 'skills-llm' — matches the archive node id when domains.length === 1
  label: string;
  domains: Domain[];
  items: string;
  /** Substring of `items` worth calling out visually (e.g. underlined on the page). */
  highlight?: string;
}

export const SKILLS: SkillGroup[] = [
  {
    id: "skills-llm",
    label: "LLM / GenAI",
    domains: ["llm"],
    items:
      "RAG · LLM fine-tuning · agent harness engineering · loop engineering · MCP · vLLM · Vertex AI · Gemini · OpenAI API · Hugging Face",
    highlight: "agent harness engineering · loop engineering",
  },
  {
    id: "skills-ml",
    label: "ML / Deep Learning",
    domains: ["ml"],
    items: "PyTorch · TensorFlow · Keras · scikit-learn · BERTopic · model interpretability (Captum)",
  },
  {
    id: "skills-data",
    label: "Data / Infra",
    domains: ["data"],
    items: "BigQuery · Cloud Spanner · Cloud Run · Cloud Functions · Docker · Terraform · FastAPI · GCP · Git",
  },
  {
    id: "skills-vision",
    label: "Computer Vision",
    domains: ["vision"],
    items: "medical imaging (CT / ultrasound) · NFNet",
  },
  {
    id: "skills-code",
    label: "Code",
    domains: ["llm", "ml", "data", "vision"],
    items: "Python (advanced) · SQL · JavaScript / TypeScript",
  },
];

// ── selected works ───────────────────────────────────────────────────────

export interface WorkEntry {
  id: string; // 'works-vault'
  kind: "flagship" | "inline";
  /** Compact form used in the archive label, e.g. "VAULT-MCP". */
  shortName: string;
  /** Overline shown on flagship cards, e.g. "◇ TRACE — 001 · GRAPHRAG / MCP". Unused for inline works. */
  traceLabel?: string;
  name: string;
  desc: string;
  /** Stat lines under the description (flagship cards only). */
  metrics?: string[];
  domains: Domain[];
  /** The Worldline self-reference gets the α marker + corner marks. */
  isAlpha?: boolean;
  /** Grant / funding note (Hashtag's TED Fund line). */
  grant?: string;
  period?: string;
}

export const WORKS: WorkEntry[] = [
  {
    id: "works-vault",
    kind: "flagship",
    shortName: "VAULT-MCP",
    traceLabel: "◇ TRACE — 001 · GRAPHRAG / MCP",
    name: "Personal-OS / vault-mcp",
    desc: "Local GraphRAG MCP server (Python / FastMCP) over a 500+-note Obsidian vault, with cross-modal text→image retrieval.",
    metrics: ["522 embedded nodes · ~150 ms/query", "0.25 ms vector search · 124 tests"],
    domains: ["llm", "data"],
  },
  {
    id: "works-farm",
    kind: "flagship",
    shortName: "BILLION FARM ERP",
    traceLabel: "◇ TRACE — 002 · FULL-STACK / VISION",
    name: "Billion Farm ERP",
    desc: "End-to-end ERP for a family broiler farm (Next.js / TypeScript, Supabase), run from the field via a LINE bot — Gemini vision scores photo-proof of work, fail-safe by design.",
    metrics: ["39-table multi-tenant RLS schema", "0–1 confidence · low → human review"],
    domains: ["llm", "vision", "data"],
  },
  {
    id: "works-worldline",
    kind: "flagship",
    shortName: "WORLDLINE",
    traceLabel: "α TRACE — 003 · LIVE / META",
    name: "Worldline-Atlas",
    desc: "This site — a personal digital-identity space designed & built end-to-end by one engineer directing an agent harness to designer-quality UI. Taste-led, not templated.",
    metrics: ["the résumé you are reading", "is part of the system"],
    domains: ["llm"],
    isAlpha: true,
  },
  {
    id: "works-namfon",
    kind: "inline",
    shortName: "NAMFON AI",
    name: "Namfon AI",
    desc: "self-initiated reasoning Thai LLM",
    domains: ["llm", "ml"],
    period: "2025",
  },
  {
    id: "works-hashtag",
    kind: "inline",
    shortName: "HASHTAG",
    name: "Hashtag: AI News Agency",
    desc: "de-biasing news + daily summaries",
    grant: "TED Fund grant · ฿100,000",
    domains: ["ml"],
    period: "2021–22",
  },
];

// ── recognition ──────────────────────────────────────────────────────────

export interface RecognitionItem {
  title: string;
  detail?: string;
  /** True only for the flagship line (accent glyph, larger emphasis). */
  highlight?: boolean;
}

export const RECOGNITION: RecognitionItem[] = [
  {
    title: "Silver Medal — Super AI Engineer S1",
    detail: "1 of 19 advanced awardees / 2,000+ candidates",
    highlight: true,
  },
  { title: "TED Fund grant", detail: "100,000 THB — Hashtag: AI News Agency" },
  { title: "Build on ASEAN 2021 — finalist", detail: "AWS" },
  { title: "Sustainability Expo 2022 — finalist & pitcher" },
  { title: "JSTP #22 scholar", detail: "junior science talent project" },
];

// ── origin / education ───────────────────────────────────────────────────

export interface EducationItem {
  program: string;
  institution: string;
  period: string;
}

export const EDUCATION: EducationItem[] = [
  { program: "B.Eng, Environmental Engineering", institution: "Chulalongkorn University", period: "Aug 2020 – Dec 2024" },
  { program: "Mahidol Wittayanusorn (MWIT)", institution: "Science-gifted program", period: "2017 – 2020" },
];

// ── languages ────────────────────────────────────────────────────────────

export interface LanguageItem {
  name: string;
  level: string;
  detail?: string;
}

export const LANGUAGES: LanguageItem[] = [
  { name: "Thai", level: "Native" },
  { name: "English", level: "Professional — daily, global teams", detail: "TOEIC 810 · U.S. J-1 (2022)" },
];

// ── certificates ─────────────────────────────────────────────────────────

export const CERTIFICATES: string[] = [
  "Generative AI with LLMs (DeepLearning.AI)",
  "Image Classification with TensorFlow on Google Cloud",
  "GATI8 — Chula × Tokyo Tech (2023)",
  "Shopee Code League 2022",
];

// ── colophon ─────────────────────────────────────────────────────────────

export interface Colophon {
  text: string;
  stack: string[];
}

export const COLOPHON: Colophon = {
  text:
    "this résumé — and the worldline surface around it — was designed & engineered end-to-end by the observer: one engineer directing an agent harness to designer-quality output. the résumé is itself the system-design sample.",
  stack: ["NEXT.JS", "THREE.JS", "HARNESS-ENGINEERED", "NO TEMPLATE"],
};
