export const meta = {
  name: 'zerotrust-cert-design',
  description: 'READ-ONLY design synthesis: map EVERY control in the Zero Trust for AI Agents doc (full detail + implementation + Claude-Code pro-tips, all 3 tiers) against our existing harness census, classify each control deterministic-sensor vs agent-judge (deterministic-FIRST, judge minimal), and produce a certification-readiness design doc + sensor manifest for Peat review BEFORE any build. No code edits, no build.',
  phases: [
    { title: 'Map', detail: 'parallel control-mappers, each owns one Zero Trust section × our census' },
    { title: 'Synthesize', detail: 'one cert-design doc + sensor manifest, deterministic-first' },
  ],
}

const PDF = '/Users/neospiritth/Downloads/6a1611a04085d7cd3dadc924_Claude-eBook-Zero-Trust-for-AI-Agents-05182026.pdf'
// Pre-distilled guideline (full-read agent already extracted all 3 tiers + every control +
// every Claude-Code pro-tip with mechanism). Agents read THIS, not the 36pp PDF ×8 — faster,
// cheaper, and avoids the 36pp×8 read that fed the memory-leak crash of the first run (wss54r23u).
const DISTILLED = '/Users/neospiritth/codingspace/personal_website/docs/team/ZERO-TRUST-GUIDELINE-DISTILLED-2026-06-01.md'

// Ground-truth census Polaris already gathered — agents BUILD ON this, do not re-derive.
const CENSUS = `HARNESS CENSUS (Polaris-verified 2026-06-01, ground truth — build on it):
ACTIVE systems (in use every session):
  - .claude/hooks/ — 13 WIRED in settings.json: session-start, on-dispatch(PreToolUse/Agent), read-gate-beta, write-protect-beta, post-edit, postuse-agent-counter, prototype-ready, persona-tracker, beta-context-inject, pre-compact-beta-scribe, sign-work(Stop, gated on $CLAUDE_TASK_ID), save-checkpoint(Stop), beta-timeline-append(Stop). 8 UNWIRED on disk (harness-check, pre-handoff, visual-diff, agent-name-trigger, grant-cleanup, beta-grant, beta-scribe-runner, access-log-beta).
  - scripts/audit-*.sh ×23 (DETERMINISTIC checks, this is our strength): territory, design-tokens, font-chain, soul-atom-drift, next-api, voice, a11y, gauntlet-min-legible, gauntlet-overlap, gauntlet-sub-pixel, axiom-gate-join-coverage, prototype-discipline, prototype-runtime, prototype-production-diff, visual-diff-directions, a1-mutation-harness, beta-scribe-output. (.ts twins for some.)
  - .harness/ — axioms-v1.json (9 SIGNED axioms V1-V3/C1-C5/H1 product+convention+harness tiers), axioms-v1.schema.json, worldline-harness.config.json (rails: territory/design-tokens/next-16-api/voice/... owner Canopus, signature_policy), allowed-overlaps.json, runtime-allowlist.json.
  - .claude/signatures/ — 163 signed work records + SCHEMA.md + AUDIT.md. sign-work.sh writes a signature at Stop; Polaris/Algol verify files_touched vs diff. Known gap: empty steps[] / no-baseline recurs.
  - soul-atlas drift gate + render-fidelity gauntlet (SOUL-FACTORY): token provenance + font-chain + Playwright render-compare (the only existing render check, scoped to the gallery, NOT production routes).
DORMANT system (gitignored, NEVER installed on Worldline — ported from farm-erp, audit last fired 2026-05-07 on farm-erp fixtures, no harness:* npm scripts, no pre-commit symlink):
  - worldline-harness/.harness/ — FULL engine: deterministic sensors (globe-discipline, phase-scope, netra-voice-shallow, tokens, secrets, next16, typecheck, lint, placement, test-presence, mutating-action, task-discipline); LLM JUDGES (watchdog, heavy, task-substance — these are the NON-DETERMINISTIC part Peat wants MINIMIZED); LSP host (typescript+eslint); attestation/contract system (task lifecycle: plan→discover→contract→...→complete); anchor pack (intent/design-rails/tech-rails/progression/workflow); situation-report format; tier modes shadow→warn→block with promotion ledger; audit ndjson. config: sensors mostly mode=block, judges mostly mode=shadow/warn.
THE GAP that caused today's failures (NEITHER system catches these — they are why we are here):
  - render-fidelity-vs-intent: /archive shipped as a crooked overlay when Peat decided a separate page; no gate compares rendered surface to design intent.
  - ground-truth-observed: "build green + 200" passed as "done"; nobody opened the page. Proxy not anchor.
  - search-index-completeness: pagefind indexed 2/15 pages (data-pagefind-body was display:none); no gate asserts index page_count == crawlable count.
  - config-integrity / single-source: globe exists as 3 divergent blobs across branches; fixes scattered to prototype/handoff, never ported to production .tsx.
PEAT DIRECTIVES (hard constraints for your mapping):
  1. DETERMINISTIC-FIRST. For every Zero Trust control, prefer a deterministic script (like our audit-*.sh) over an LLM judge. Classify each control: DETERMINISTIC (scriptable hard gate) | JUDGE-REQUIRED (genuinely needs an LLM, e.g. aesthetic/intent drift) | HYBRID (deterministic pre-gate + judge only on the residue). Minimize JUDGE-REQUIRED.
  2. "impossible, not tedious" (doc p.4): a control counts only if it REMOVES a capability / hard-blocks, not if it merely adds friction. Mark each control: HARD-BARRIER vs FRICTION-ONLY.
  3. Revive worldline-harness as substrate but COLLAPSE the name collision with .harness/ (two things named worldline-harness today). Judges start in shadow; promote to block only where no deterministic equivalent exists.
  4. Full DETAIL + IMPLEMENTATION from the doc, not just concept. Every "Pro-tip: Claude Code supports this via X" is a concrete implementation hook — capture it.`

const MAP_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    section: { type: 'string' },
    controls: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      control: { type: 'string' },
      ztDetail: { type: 'string' },              // what the doc says (detail, not concept)
      tierTable: { type: 'string' },             // Foundation / Enterprise / Advanced implementations from the doc
      claudeCodeProtip: { type: 'string' },      // the doc's "Claude Code supports this via X" implementation
      weHaveToday: { type: 'string' },           // exact file/script/hook in our census, or NONE
      classification: { type: 'string' },        // DETERMINISTIC | JUDGE-REQUIRED | HYBRID
      barrier: { type: 'string' },               // HARD-BARRIER | FRICTION-ONLY
      certTierNow: { type: 'string' },           // none | Foundation | Enterprise | Advanced
      gap: { type: 'string' },                   // what's missing to reach the next tier
      proposedSensor: { type: 'string' },        // concrete deterministic sensor/script spec if scriptable
      owner: { type: 'string' },                 // Canopus(hooks/harness) | Algol(audit logic/tests) | Sirius | Procyon | Polaris
    }, required: ['control', 'ztDetail', 'weHaveToday', 'classification', 'barrier', 'certTierNow'] } },
    notes: { type: 'string' },
  },
  required: ['section', 'controls'],
}

phase('Map')
const SECTIONS = [
  { key: 'principles-blast-agency', pages: '4-7', prompt: 'Zero Trust PRINCIPLES + Part I (pp.4-7): never-trust/always-verify, assume-breach, least-privilege; the "impossible not tedious" design test; blast radius; least agency (OWASP); regulated-industry alignment. Map each PRINCIPLE to how it should govern OUR harness (it is the meta-test for every other control). Classify the "impossible not tedious" test as the spine.' },
  { key: 'threats', pages: '8-11', prompt: 'Part II threats (pp.8-11): prompt injection (direct+indirect), tool/resource misuse, tool poisoning, tool chaining, identity/privilege abuse, unscoped privilege inheritance, memory/context/RAG/shared-context poisoning, supply chain (model+tool). For EACH threat, map: does our system have ANY control today? which? Most map to deterministic sensors (secrets-scan, command-allowlist, mutating-action). Flag which threats we have ZERO coverage for.' },
  { key: 'identity-access-resource', pages: '13-15', prompt: 'Part III — Agent identity & authentication + Access control & privilege management + Resource boundaries (pp.13-15, READ THE TIER TABLES). Controls: unique cryptographic agent identity, service auth (short-lived tokens), RBAC deny-by-default, ABAC, privilege scoping JIT/JEA, identity-based isolation, sandboxed execution. Our census: signatures(crypto identity-ish), territory rail, settings.json deny-by-default permissions, write-protect-beta, sandbox. Map each tier-row to our reality + the Claude Code pro-tips (deny-by-default permissions, sandboxed execution, write access restrictions, managed settings).' },
  { key: 'observability-behavioral', pages: '16-18', prompt: 'Part III — Observability & auditing + Behavioral monitoring & response (pp.16-18, TIER TABLES). Controls: action logging, immutable audit trails, traceability/request-IDs, baseline establishment, anomaly detection, automated response. CRITICAL FOR PEAT DIRECTIVE: behavioral monitoring/anomaly/baseline is where LLM-judges live — classify these carefully as JUDGE-REQUIRED vs whether a deterministic threshold/diff can do it. The doc rule "automate the bookkeeping, not the decisions" (p.18) is central — map it. Our census: audit/index.ndjson, signatures, situation-report, save-checkpoint, OTel pro-tip, dwell-time/coverage metrics.' },
  { key: 'input-output-integrity', pages: '18-21', prompt: 'Part III — Input validation & output controls + Integrity & recovery + AI governance (pp.18-21, TIER TABLES). Controls: input sanitization, content filtering, spotlighting/constitutional-classifiers, output filtering, human-in-the-loop for high-risk, config integrity (version-controlled/signed/immutable), recovery/rollback, governance policies. Map to our: read-gate-beta, command blocklist, secrets-scan, git version control, save-checkpoint/rewind, drift gate. The Claude Code pro-tips here are dense (command-injection detection, fail-closed matching, isolated context windows, network-request approval, version-controlled settings, managed settings) — capture all.' },
  { key: 'impl-workflow-supplychain', pages: '22-28', prompt: 'Part IV Agent implementation workflow (pp.22-28): Phase1 requirements, Phase2 supply chain (AI-BOM, OpenSSF Scorecard, dependency-tree audit, reachability, AI-vendoring, cryptographic signing), Phase3 agent boundaries (assign unique identity, approved/prohibited actions, escalation triggers, scope limits, blast radius), Phase4 prompt-injection defense (input isolation, constitutional classifiers, limit attack surface), Phase5 secure tool access (allow-listing, capability restrictions, parameter validation via PreToolUse hook, sandbox), Phase6 protect credentials (short-lived, hardware-bound, credential isolation, JIT, ABAC, trust boundaries), Phase7 safeguard memory. Map each phase-step to our census + the heavy use of settings.json/hooks pro-tips. Note our concrete: package.json deps (the ai-sdk install today), no AI-BOM, no Scorecard wiring.' },
  { key: 'defensive-ops-metrics', pages: '29-35', prompt: 'Part V Defensive operations + Phase 8 measure-what-matters + "From principles to practice" (pp.29-35): dwell time, detection speed (within-an-hour test), coverage, explainability, behavioral conformance, put-a-model-at-front-of-alert-queue, agentic SOAR, MITRE ATT&CK mapping, tabletop for 5 incidents, emergency change procedures, trust-through-verification for defensive agents. THIS SECTION IS THE DIRECT MIRROR OF TODAY\'S FAILURE (dwell time = days not hours; nobody knew /archive was broken). Map each metric to whether we measure it + propose the deterministic instrument. Also map the bug-cross-cut: coord-on-hover regression, through-globe, search-empty, intent-drift — which Zero Trust control SHOULD have caught each, and the deterministic sensor that would.' },
]
const mapped = (await parallel(SECTIONS.map((s) => () =>
  agent(`${CENSUS}

YOUR SECTION: read the DISTILLED guideline at ${DISTILLED} via the Read tool — it already contains the FULL extracted detail (all 3 tier tables, every control with deterministic/judge + hard-barrier/friction classification, every Claude-Code pro-tip with its concrete mechanism). Work from the distilled doc as your primary source; only open the original PDF (${PDF}, your topic is around pages ${s.pages}) if you need to verify an exact quote or a tier-table cell the distillation abbreviated. Do not work from memory.
${s.prompt}

For each control in your section return a structured row per the schema: the doc's DETAIL (not concept), its tier table (Foundation/Enterprise/Advanced implementations), the Claude Code pro-tip implementation, what WE have today (cite exact file from the census), DETERMINISTIC vs JUDGE-REQUIRED vs HYBRID (deterministic-first — justify any JUDGE-REQUIRED), HARD-BARRIER vs FRICTION-ONLY, our current cert tier (none/Foundation/Enterprise/Advanced), the gap, and a concrete deterministic sensor spec + owner where scriptable. READ-ONLY — do not edit anything.`,
    { agentType: 'general-purpose', label: `map:${s.key}`, phase: 'Map', schema: MAP_SCHEMA })
    .then((m) => ({ key: s.key, ...m })).catch(() => null)
))).filter(Boolean)
log(`Mapped ${mapped.length}/${SECTIONS.length} sections · controls: ${mapped.reduce((n, m) => n + (m.controls?.length || 0), 0)}`)

phase('Synthesize')
const ALL = JSON.stringify(mapped).slice(0, 40000)
const design = await agent(`${CENSUS}

FULL CONTROL MAP from all sections: ${ALL}

TASK (synthesis — write the certification-readiness design doc to docs/team/SECURITY-HARNESS-DESIGN-2026-06-01.md, <=400 lines, AND a machine-readable sensor manifest sketch to docs/team/sensor-manifest-draft.json):
The doc must let Peat decide whether to approve the build. Structure:
1. EXECUTIVE: the thesis — "gate measures ground-truth not proxy; deterministic-first, judge minimal; substrate = revived worldline-harness with the .harness name-collision collapsed." State the 4 bugs today and which control each maps to.
2. SUBSTRATE DECISION: how to revive worldline-harness/ + merge with active .claude/hooks + .harness/ axioms into ONE system; resolve the duplicate "worldline-harness" naming; what to install (harness:* scripts, pre-commit), what to adapt (farm-erp→Worldline fixtures/anchors), what to drop.
3. THE CONTROL MATRIX: one table over ALL mapped controls — | control | ZT tier table (brief) | Claude Code impl | we-have-today | DETERMINISTIC/JUDGE/HYBRID | HARD-BARRIER/FRICTION | cert tier now | gap | proposed sensor | owner |. This is the heart — full detail, every control.
4. DETERMINISTIC-FIRST LEDGER: the count — how many controls deterministic vs judge-required; list every JUDGE-REQUIRED with the justification why deterministic cannot do it; confirm judges start shadow.
5. NEW SENSORS for today's bugs: concrete deterministic specs for render-fidelity-vs-intent, ground-truth-observed (DoD = a real screenshot+ack artifact exists, script-checked), search-index-completeness (page_count==crawlable), config-integrity/single-source. Each with owner (mostly Canopus + Algol) + how it would have caught the specific bug.
6. CERTIFICATION READINESS: per Zero Trust tier (Foundation/Enterprise/Advanced), which controls we'd meet after the build; what "certified" honestly means and does NOT mean (we are a solo personal site, not enterprise — be honest about which Advanced controls are N/A like HSM/confidential-computing).
7. BUILD PLAN (gated, NOT executed this run): ordered waves with owners; Canopus owns harness/hooks, Algol owns audit logic+tests, each wave checkpoints to Peat. Note the irony-guard: this is design-only; build needs Peat approval.
Be honest where the doc's Advanced tier is overkill for a solo garden — "impossible not tedious" cuts both ways (don't add enterprise theater). Return the doc path + control counts + the single highest-leverage deterministic sensor.`,
  { agentType: 'general-purpose', label: 'synthesize', phase: 'Synthesize', schema: {
    type: 'object', additionalProperties: false, properties: {
      docPath: { type: 'string' },
      manifestPath: { type: 'string' },
      controlCount: { type: 'integer' },
      deterministicCount: { type: 'integer' },
      judgeRequiredCount: { type: 'integer' },
      certReadiness: { type: 'string' },
      topSensor: { type: 'string' },
      buildWaves: { type: 'array', items: { type: 'string' } },
    },
    required: ['docPath', 'controlCount', 'deterministicCount', 'judgeRequiredCount'],
  } })
log(`Design: ${design?.docPath} · ${design?.deterministicCount}det/${design?.judgeRequiredCount}judge of ${design?.controlCount}`)

return {
  scope: 'READ-ONLY Zero Trust → Worldline harness certification design (full detail + implementation)',
  sectionsMapped: mapped.map((m) => ({ section: m.key, controls: m.controls?.length || 0 })),
  design,
  polaris_note: 'Design only — no code edited, no build run. Polaris verifies the matrix against the PDF + census before presenting to Peat (lesson: do not forward agent output unchecked). Build is a SEPARATE gated wave Peat must approve. Deterministic-first, judges shadow, name-collision collapsed.',
}
