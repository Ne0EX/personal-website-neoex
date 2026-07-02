/**
 * Resume content — single source of truth extracted from docs/resume-content.md.
 * Domain: neoex.dev / resume.neoex.dev
 * Do NOT add invented metrics or XYZ bullets here.
 * Directive: where · what · helped, general but with impact.
 */

export interface ExperienceEntry {
  company: string;
  role: string;
  location: string;
  period: string;
  isCurrent: boolean;
  body: string;
}

export interface SkillGroup {
  label: string;
  items: string;
}

export interface Project {
  name: string;
  desc: string;
}

export const EXPERIENCE: ExperienceEntry[] = [
  {
    company: "social.plus",
    role: "AI Engineer",
    location: "Bangkok",
    period: "Sep 2025 – Present",
    isCurrent: true,
    body: "The platform's first and only AI engineer, owning the data & AI layer end-to-end. Built the intelligence that makes the product feel personal — how feeds rank, how audiences are understood, how customers can question their own data in plain language — running in production across multiple regions.",
  },
  {
    company: "Super AI Engineer, Season 5",
    role: "AI Coach",
    location: "Thailand",
    period: "Jun – Oct 2025",
    isCurrent: false,
    body: "Coached a junior team to a regional championship in brain-tumor medical imaging, and mentored them past the model itself — into how an innovation actually reaches a market.",
  },
  {
    company: "Western Digital (Thailand)",
    role: "AI Engineer Intern",
    location: "Bang Pa-In",
    period: "Jul – Nov 2024",
    isCurrent: false,
    body: "The company's first Gen-AI adopter. Built and shipped a private RAG system that reshaped how a global manufacturer approached generative AI — earning two return offers.",
  },
  {
    company: "Excellence Center of GI Oncology, Chulalongkorn University",
    role: "ML Engineer Intern",
    location: "Bangkok",
    period: "Mar 2021 – Apr 2022",
    isCurrent: false,
    body: "Built a liver-cancer surveillance model from medical ultrasound, helping push early HCC detection forward — research presented at Digestive Disease Week (DDW) 2022.",
  },
  {
    company: "AVA Advisory",
    role: "Research Intern",
    location: "Bangkok",
    period: "Jun – Jul 2020",
    isCurrent: false,
    body: "Early reinforcement-learning research — first hands on the craft.",
  },
];

export const SKILLS: SkillGroup[] = [
  {
    label: "LLM / GenAI",
    items: "RAG · fine-tuning · agent & loop engineering · MCP · vLLM · Vertex AI · Gemini · OpenAI · Hugging Face",
  },
  {
    label: "ML / Deep Learning",
    items: "PyTorch · TensorFlow · scikit-learn · model interpretability",
  },
  {
    label: "Data / Infra",
    items: "BigQuery · Cloud Spanner · Cloud Run · Docker · Terraform · FastAPI · GCP",
  },
  { label: "Computer Vision", items: "medical imaging (CT / ultrasound) · NFNet" },
  { label: "Languages", items: "Python · SQL · JavaScript" },
];

export const PROJECTS: Project[] = [
  {
    name: "Personal-OS / vault-mcp",
    desc: "a local GraphRAG server over a 500+-note knowledge vault, returning concept-relevant notes and images cross-modally in real time.",
  },
  {
    name: "Billion Farm ERP",
    desc: "end-to-end ERP for a family farm, run from the field via a chat bot, with a vision layer that verifies work from photo evidence.",
  },
  {
    name: "Worldline",
    desc: "this digital-identity space, vibe-coded end-to-end toward designer-quality UI rather than templated output.",
  },
];

export const LINKS = [
  { label: "github.com/Ne0EX", href: "https://github.com/Ne0EX" },
  {
    label: "linkedin.com/in/krittiphong-manachamni",
    href: "https://linkedin.com/in/krittiphong-manachamni",
  },
  { label: "neoex.dev", href: "https://neoex.dev" },
  { label: "krittiphong2019@gmail.com", href: "mailto:krittiphong2019@gmail.com" },
];
