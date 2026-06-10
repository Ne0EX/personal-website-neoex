# SPEC 2026-06-11 — Portable Symbiote Factory (GENESIS full-system port)

> **Provenance.** Produced by a Polaris-orchestrated multi-agent study on **2026-06-11**
> (architecture synthesis → fan-out claim extraction → adversarial verify → deterministic
> backstop → synthesis). **Every recommendation here is agent-originated.** NOTHING in this
> document is a Peat decision yet. All recommendations carry **PROPOSED** status until Peat
> signs. Where the verify phase **refuted** an originating claim, this SPEC uses the correction
> and shows it openly (see §9) — a refutation is credibility, not embarrassment.
>
> Branch: `genesis/soul-factory`. Off-`main` by policy (main is web-only). Status: **DRAFT for review.**

---

## 1. Thesis & constitution

The Symbiote Factory is a **portable bonding ritual whose files are residue.** What ships is not
a tarball and not a compiler — it is a **staged sequence of gates.** Files are only what each
stage leaves on the host. The product is the protocol; the engine is what travels verbatim
inside it.

This is the "trust machine (symbiote)" thesis made concrete: a portable false-green-eliminator
separated *out* of GENESIS that bonds to any host, **engine portable, axioms per-host-signed
(Venom, not Carnage).**

### Constitutional properties — stated at bond-time, never silently

1. **Venom, not Carnage — the hard seam.** The **ENGINE** half is host-blind machinery that
   ports byte-for-byte. The **AXIOM / TERRITORY / RAILS** half *names a host* and is never
   imported — only re-derived and Peat-signed *on* the host. Copying personas verbatim imports
   the old host's axioms = Carnage. (`.claude/skills/genesis-host-port/SKILL.md`, head matter +
   §pattern.)

2. **The irreducible root is DETECTIVE + LAGGED.** Attribution, not prevention; lag = publish
   cadence. The trust claim bottoms out in **committed git history witnessed by independent CI
   over a ref the agent cannot rewrite, gated by a human-only no-force-push toggle.** Every
   *local* anchor falls to an fs-read+write agent. Three components, all required:
   (a) a CI witness substrate the agent cannot fake, (b) append-only git history, (c) a
   no-force-push branch-protection toggle only Peat can set.
   (`.harness/WITNESS-REF-DESIGN.md` §1–§2.) A fully-informed *malicious authority* is declared
   out of scope — declared, not hidden.

3. **Peat-at-seam, irreducibly.** Two acts are Peat's alone and the agent can never perform
   them: **signing the per-host axiom registry**, and **setting the no-force-push branch
   protection** on the witness ref. Never a Peat-key git commit-signing gate (it would gate
   agent verify-and-close autonomy on his key) — the ceiling is raised via CI + commit
   granularity instead.

4. **Stage-0 comprehension before any axiom.** The bond opens by declaring a **blindness
   ceiling**: the host's substrate hygiene measured as a **RANGE, not a point.** Every
   unmeasurable input routes to `quarantined-unknowable` as a **silent gap** — never read absent
   data as 0. (`.claude/skills/comprehension-onboarding/SKILL.md` Stage 0.)

5. **No silent sensor drops.** Hosts degrade sensors per capability and **the factory SAYS what
   it dropped** in the capability report. A force-push frequency on a local clone is *unreadable*,
   so it is reported unreadable — not assumed clean.

6. **Compounding back to the factory.** Every lesson learned on a host flows BACK into
   `ENGINE/skills` and `ENGINE/factory`, never forked per host — the orchestration-as-skills
   discipline. The factory improving itself is subject to the same single-human-gate it ships.

7. **Every stage is reversible.** Uninstall is the protocol run backwards. Because the engine
   never silently mutated the host (stage-then-install via the gate-orthogonal Write tool +
   diff-verify), reversal is removing recorded residue + diff-verifying byte-identical-to-pre-bond.

### The false-green floor (three-layer verification)

Every artifact is built off-host to **STAGING**, then:
(a) **adversarial-verify** — a *different* agent tries to FAIL it (builder ≠ attacker, no
self-grading); (b) a **deterministic grep backstop** run by the main loop (NOT an agent) that
READS the actual files — this is what actually clears the batch, because LLM verifiers are
nondeterministic; (c) **one opus completeness-critic** backstops the cheap fan-out. A
**NOT-TIGHT** verdict on a large-surface verb is the skill *working* (it stops removal on false
confidence), not failing. Polaris runs a ground-truth pass between verify and any commit.
(`adversarial-harden/SKILL.md` — note: the concrete skill file is regrounded at wiring, named-agent references and harness dir layout are host-specific; only the algorithm/economics port verbatim; `genesis-host-port/SKILL.md` §pattern.)

---

## 2. Factory architecture

### 2.1 The engine / axiom line (the one seam that runs through everything)

| Side | Travels how | Contents |
|---|---|---|
| **ENGINE** (Venom — host-blind) | copied byte-for-byte | `comprehension-onboarding` skill; `.harness/engine/` core (sensors/judges/runtime + per-runtime adapters); the witness-root **mechanism**; the **ONE** canonical shell template; the honesty **schemas**. **`genesis-host-port`, `sensor-wave`, and `adversarial-harden` skills: the algorithm/discipline dimension ports verbatim; the concrete skill files are reground-at-wiring (genesis-host-port's run-log/gotchas carry host residue — the mutating-gate reference and the Ne0EX-life run record; Worldline-coupled descriptions, named-agent references, harness dir layout re-derived per host — see §9 C13/C14 and §10 registry, which lists all three under reground).** |
| **AXIOM / TERRITORY / RAILS** (per-host) | re-derived + Peat-signed *on* the host | the host's truths (axiom registry), its dir layout (territory), its token file, its persona roles, its rail/sensor registry |

The engine→travels / rails→re-derive theory is **already proven once** at the harness layer
(Billion-Farm-ERP → Worldline: anchors rewritten, sensors added/removed, adapters re-pathed;
`.harness/engine/README.md` + `NAME-COLLISION-RESOLUTION.md`). The full *ritual* was executed
once (9 read-only shells into the non-git `Ne0EX-life` vault; `docs/team/SPEC-2026-06-06-
genesis-vault-port-B.md`).

> **Correction carried from verify (C1).** The engine is **not yet** a clean portable core. Three
> Worldline-specific sensors — `globe-discipline`, `phase-scope`, `netra-voice-shallow` — are
> *unconditionally* imported and registered in `.harness/engine/core/cli.ts` (verified: imports at
> lines 26–28, SENSORS map ~lines 46–50). Excluding them today requires editing engine source, not
> swapping a config. The factory must treat **target-data externalization + Worldline-sensor
> de-registration as a real M1 carve step**, not a copy. The seam is the *design*; making the
> on-disk engine honor it is build work.

### 2.2 Kit layout

```
symbiote-factory/                         # the portable kit — git-tracked; ships to a host's tooling dir, NOT into the host yet
├── ENGINE/                               # ── PORTABLE VERBATIM (Venom). zero host strings ──
│   │                                   # NOTE: directory placement ≠ portability verdict. Skills marked
│   │                                   #   "reground-at-wiring" below travel here as algorithm/discipline
│   │                                   #   templates; the concrete SKILL.md is re-derived on each host
│   │                                   #   (named-agent refs, harness dir layout stripped and rewritten).
│   ├── skills/
│   │   ├── comprehension-onboarding/SKILL.md   # Stages 0–6 bonding/trust protocol (host-agnostic, FS-read default)
│   │   ├── genesis-host-port/SKILL.md          # REGROUND-AT-WIRING: generate → adversarial-verify → deterministic-backstop
│   │   │                                       #   → install pattern ports verbatim; run-log/gotchas host residue → re-derived (§10)
│   │   ├── sensor-wave/SKILL.md                # REGROUND-AT-WIRING: bypass-class taxonomy + algorithm port verbatim;
│   │   │                                       #   Worldline-coupled description → re-derived per host (C14, §9/§10)
│   │   └── adversarial-harden/SKILL.md         # REGROUND-AT-WIRING: DRY_TARGET≥2 / NOT-TIGHT economics port verbatim;
│   │                                           #   named-agent refs (Algol+Canopus) + harness dir layout → re-derived (C13, §9/§10)
│   ├── shell-template/
│   │   └── persona.shell.md.tmpl         # THE ONE canonical shell — flat `tools:` CSV = the enforcement
│   ├── harness-engine/                   # copied from .harness/engine/ (transplant history proven once)
│   │   ├── core/{sensors,judges,runtime,lib,cli.ts,types.ts}   # de-register Worldline-only sensors at M1 (see §2.1 correction)
│   │   └── adapters/{claude-code,git,codex,copilot-cli}/       # claude-code(5 hooks)+git(2 hooks) WIRED; codex+copilot README stubs
│   ├── trust-root/                       # the forge-resistant root MECHANISM, shipped INERT
│   │   ├── WITNESS-REF-DESIGN.md         # (a)CI-witness (b)append-only history (c)no-force-push toggle — the irreducible three
│   │   ├── audit-ledger-append-only.sh   # first-parent prefix walk (NOT a hash-recompute)
│   │   ├── integrity-write-ledger.sh     # the producer/observer (always exit 0; one-time not_a_chain header)
│   │   └── ci-witness.yml.tmpl           # CI witness job template (no secrets, no signing)
│   ├── schemas/                          # ── THE SEAM + HONESTY, MADE MACHINE-READABLE ──
│   │   ├── axioms.schema.json            # generalized from axioms-v1.schema.json (V/C/H tiers, projects_to, must_project_by fail-closed)
│   │   ├── host-facts.schema.json        # GRAFT: every capability field RANGE-or-quarantined, never a point
│   │   ├── blindness-ceiling.schema.json # Stage-0 output: ranges-not-points, quarantined-unknowable, declared residual
│   │   └── partition.schema.json         # Stage-4 output: every load-bearing seam labeled exactly one class
│   └── factory/
│       ├── bond.sh                       # THE orchestrator: drives the 7 stages, writes STATE/ ledger, runs JOIN check, aborts clean (pure shell)
│       ├── host-capability-probe.sh      # detects git / git+CI / non-git-FS / incumbent-custodian → host-profile.json (schema-validated)
│       ├── join-check.sh                 # GRAFT (shell, NOT TS): signed PROJECTED axiom ↔ real gate bijection, fail-closed
│       ├── uninstall.sh                  # GRAFT: receipt-driven reversal; diff-verifies byte-identical-to-pre-bond
│       └── symbiote                      # OPTIONAL thin dispatch CLI → bond.sh / uninstall.sh / verify (operator UX only)
├── STATE/                                # per-bond runtime ledger — NOT shipped; the audit trail of the ritual itself
│   └── <host-id>/
│       ├── 00-host-profile.json          # Stage-0 probe (substrate, CI?, custodian?, fossils) — schema-validated
│       ├── 00-blindness-ceiling.json     # declared ceiling + residual + quarantined-unknowable (ranges, not points)
│       ├── 04-partition.json             # confirmed-actual / confirmed-dead / quarantined-* per seam
│       ├── 05-grill-agenda.md            # DIFF(believed,actual) ranked queue surfaced to Peat
│       ├── 06-axioms.proposed.json       # machine-PROPOSED (status=UNPROJECTED, signed_by=null) — NEVER auto-signed
│       ├── 06-axioms.signed.json         # PEAT-SIGNED registry (the only file the human authors)
│       ├── engine-sha.json               # GRAFT: sha256 of every installed ENGINE file → re-bond drift-detect (FRICTION)
│       ├── install-receipt.json          # GRAFT: {path,sha256,ts} of every host write → drives O(files) uninstall
│       ├── bond-ledger.jsonl             # append-only record of every stage entry/exit/gate-decision/abort (full audit)
│       └── ABORT-REASON.md               # written only if a gate aborts; names failed precondition + clean-state proof
└── STAGING/                              # adversarially-verified artifacts BEFORE they touch the host — Write-tool install, then diff-verify
    └── <host-id>/
        ├── .claude/agents/<persona>.md × N        # re-grounded shells (old-host territory stripped, flat tools = enforcement)
        ├── .claude/skills/comprehension-onboarding/SKILL.md   # the gate, installed into the host
        ├── .harness/axioms.json                   # copied from STATE/06-axioms.signed.json
        ├── .harness/<host>-harness.config.json    # rail registry — only PROJECTED + substrate-enforceable rails
        └── scripts/audit-*.sh                      # host-specific sensors sensor-wave built for signed+enforceable axioms
```

**Residue partition (what each stage leaves on the HOST, under host/.claude + host/.harness):**
- **ENGINE** → copied verbatim from `ENGINE/` (skills, harness-engine, trust-root mechanism, shell template).
- **AXIOMS** → `host/.harness/axioms.json` (Peat-signed on THIS host; re-authored, re-signed — never imported).
- **RAILS** → `host/.harness/<host>-harness.config.json` + `host/scripts/audit-*.sh` (re-derived for signed enforceable axioms only).
- **SHELLS** → `host/.claude/agents/*.md` (re-grounded, deny-by-default; dormant until a host role is granted).
- **no-port** → never bonds (see §5).

### 2.3 The re-grounding step (what "Venom not Carnage" looks like at build time)

From the **one** `persona.shell.md.tmpl` (verifier and generator share THIS file), fan-out
re-ground each persona to STAGING: strip old-host territory/rails; born deny-by-default with
**flat `tools: Read, Grep, Glob`** as the *whole* enforcement (no nested allowed/denied map — a
malformed map makes the loader inherit ALL tools); require the comprehension gate; mark dormant;
carve around the detected custodian. Sensors: `sensor-wave` builds **one deterministic sensor per
SIGNED + ENFORCEABLE axiom** — axioms the substrate can't enforce stay UNPROJECTED with a
`must_project_by` date (honestly amber). (`SPEC-2026-06-06-genesis-vault-port-B.md` §3 item 4;
`genesis-host-port/SKILL.md` §1.)

### 2.4 Grafts taken (survived scrutiny) / not taken

**Taken:**
- **`install-receipt.json`** — Stage-install emits a compact `{path, sha256, ts}` manifest of
  every host write. Makes uninstall O(files) and resolves the re-bond name-collision case without
  replaying the verbose `bond-ledger.jsonl`. (The verbose ledger stays as the full audit trail;
  the receipt is the compact uninstall manifest — this was the protocol-first design's one named
  weak point, closed by graft.)
- **ENGINE `engine-sha.json` drift-detect** — sha manifest at install + a `verify` check at the
  start of every re-bond. Drift = WARN + diff, not silent. Honest FRICTION not HARD-BARRIER (same
  irreducible-root ceiling), but catches the *common* failure (accidental edit) deterministically.
- **`host-facts.schema.json` formal contract** — every capability field is RANGE-or-quarantined,
  never a fabricated point. Makes honest-by-construction a *checkable* property at emit-time.
  Taken **without** the TypeScript compiler around it (see below).
- **JOIN bijection check** — before install, assert every PROJECTED signed axiom binds a real
  deterministic gate; an unbound axiom flips to UNPROJECTED with a `must_project_by` date and is
  named in the capability report. Closes existence≠enforcement from the axiom side. Implemented as
  `join-check.sh` (shell + grep), **not** `join.ts`.

**Not taken:**
- The full **TS compiler** (`compile.ts` + 5 `emit-*.ts` + `join.ts`). The TS-toolchain dependency
  is the adversarial break on the degraded-host criterion: a non-git Obsidian vault host may lack
  Node/tsx, so the compiler would fail *before* declaring degradation — the exact silent-cap it
  claims to prevent. The schema is **data**; `host-capability-probe.sh` (pure shell, zero new
  binary deps) validates against it.
- **MANIFEST-as-single-source binary CLI as a requirement.** The divergence-killer it solves is
  already solved by "verifier and generator derive from ONE spec section" (the canonical shell
  template). A thin `symbiote install <host>` dispatch over `bond.sh` is offered as **optional**
  operator UX, not a dependency (see §8 Q3).

---

## 3. Bonding protocol

Gate legend — **AUTO** = automatic, no human; **PEAT-SEAM** = Peat is the load-bearing actor;
**PEAT-ONLY** = irreducibly only Peat can perform the act.

| Stage | What | Gate | On abort / uninstall |
|---|---|---|---|
| **0 — Probe & declare blindness ceiling** | `host-capability-probe.sh` detects substrate (git / git+CI / non-git FS) + incumbent custodian + which provenance fossils the substrate emits. comprehension Stage 0 measures hygiene as a **RANGE**; routes unmeasurables (force-push freq on a local clone) to `quarantined-unknowable` as silent gaps; declares the residual (DETECTIVE+LAGGED, attribution-not-prevention, malicious authority out of scope). Output validated vs `host-facts.schema.json`. | **AUTO** — self-assess; honest-by-construction. The ceiling/residual emitted here is exactly what Peat later consents *against*. | No FS access → write ABORT-REASON, leave nothing. Uninstall: `rm STATE/<host-id>` — zero host residue yet. |
| **1–2 — Comprehend: three graphs + seam check (structure only)** | Recover **intended** (top-down reading), **actual** (probe/run), believed (deferred to Stage 5). Build the process graph broad-first then deep-per-step; check every SEAM connects completely, not just nodes — DIFF(intended,actual) is where killer accidental seams live. **CONSTITUTIONAL FIREWALL:** first contact reads STRUCTURE ONLY, never MEANING; meaning is `quarantined-semantic(by-design)`, deferred to a separately-gated organ (A-OS). On a non-git host this runs FS-read mode (Read/Grep/Glob), flat-tools enforced — no Bash, so no shell can mutate during comprehension. | **AUTO** for reading. PROBING `actual` at runtime (sandbox-exec) is a **separate capability grant** beyond read-only, gated; if denied, those seams route to quarantine. Any meaning-read in the transcript → **hard abort** (the firewall is load-bearing). | `rm STATE/<host-id>`; zero host residue. |
| **3–4 — Provenance probe + honest partition (the deliverable)** | Second probe at the host's MEMORY (fossils: structural / historical / redundancy). Asymmetric evidence bar — intended needs intent-signal, accident needs accident-signal, NEITHER → quarantine (inverted Chesterton's Fence), CONFLICT → auto-quarantine. Label every load-bearing seam exactly one of `confirmed-actual` / `confirmed-dead` / `quarantined-unknowable` (+ `quarantined-semantic` on a firewalled host). **DONE = zero UNLABELED load-bearing seams — NOT "no holes"** (the inverse problem is ill-posed). The quarantine list IS the grill agenda. | **AUTO** — partition + ranked quarantine machine-produced; nothing installed or signed. Many quarantines = SUCCESS, not failure. | `rm STATE/<host-id>`; zero host residue. |
| **5 — Grill the human (re-onboard the signer)** | Surface DIFF(believed,actual) to Peat — the MOST valuable output: the probe re-onboards the HUMAN, not just the machine. Walk the ranked quarantine list **one narrow seam at a time** (polaris-grill-mode: no proposal-wall, separate real decisions from defaults). Machine can't verify or has no authority → ASK; both don't know → reason together. Durational self-comprehension: diff prior beliefs vs new evidence each re-bond. Each resolved truth → candidate axiom (statement + V/C/H tier + intended `projects_to` gate-IDs). | **PEAT-SEAM.** Polaris stewards via grill-mode; friction scales with belief-divergence × load-bearing (FRICTION-strong, not HARD-barrier). The machine demands to be HEARD, not obeyed. | Peat can stop anytime — a half-resolved grill leaves only STATE residue. `rm STATE/<host-id>`. |
| **BUILD — fan-out shells + sensors → adversarial verify → deterministic grep backstop** | From the ONE `persona.shell.md.tmpl`, fan-out re-ground to STAGING (strip old-host territory; flat `tools: Read, Grep, Glob` IS the enforcement; require the gate; dormant; carve around custodian). `sensor-wave` builds ONE deterministic sensor per SIGNED + ENFORCEABLE axiom. Three-layer verify: a DIFFERENT agent adversarially verifies each artifact; the main loop runs a deterministic grep that READS the files; loop-until-dry (DRY_TARGET≥2) for hardened guardrails with NOT-TIGHT emitted honestly; one opus completeness-critic backstops the cheap fan-out. Polaris runs a ground-truth pass. | **AUTO** pipeline + CI; the opus critic is the in-pipeline backstop. | Any artifact that can't reach DRY_TARGET on a small enumerable surface, or any false-HAVE the backstop catches → stays in STAGING, never installs. `rm -rf STAGING/<host-id> + STATE`; host byte-identical. |
| **6 — Sign + JOIN-check + install (the constitutional gate)** | Peat reviews the staged install + report FIRST (which axioms bound, which gates dropped-with-reason, the blindness ceiling). The machine demands to be HEARD not OBEYED: Peat cannot sign in IGNORANCE of ground truth (informed consent, not necessarily *correct* consent); an informed/recorded override is legitimate; a hidden override is the worst failure; refusal-to-look is itself a recorded signed choice. Peat signs `06-axioms.signed.json` (V/C tiers Peat-authored; H-tier Canopus-authored + Peat-RATIFIED; `must_project_by` fail-closed). `join-check.sh` asserts every PROJECTED signed axiom binds a real gate; unbound → UNPROJECTED + named. Install STAGING→host via the gate-orthogonal **Write tool** in one reviewed move; diff-verify `installed==staging` is EMPTY and custodian byte-for-byte untouched. Emit `install-receipt.json` + `engine-sha.json`. | **PEAT-SEAM, hard.** Nothing downstream activates without a signed registry that passes schema validation AND the JOIN check. NEVER a Peat-key commit-signing gate. | Peat declines to sign → no axioms land; bond stays at **comprehension-only** (a legitimate terminal state — the host got a free honest partition). Diff non-empty or custodian touched → roll back additive install, re-stage. Uninstall: receipt-driven removal + diff-verify byte-identical-to-pre-bond. |
| **7 — Activate the forge-resistant trust-root (go-live, git host only)** | Route `ci-witness.yml.tmpl` into the host's CI (no secrets, no signing); seed the append-only ledger via `integrity-write-ledger.sh` (one-time `not_a_chain` header); establish the publish cadence (fast-forward the witness ref at each task/session boundary — NEVER a silent agent push). Trust anchors in committed git history witnessed by independent CI over a ref the agent cannot rewrite. git-no-CI: ledger + local audit only, witness UNAVAILABLE — the factory SAYS "root is self-attested, not forge-resistant." non-git: detective-from-fossils only, root degraded (stated in the report). The factory must NOT cosplay a witness that runs as the agent. | **PEAT-ONLY, irreducibly.** The single load-bearing act is the **GitHub branch-protection no-force-push toggle** on the witness ref — the one thing only Peat can set and the agent cannot. No agent ever creates or pushes the witness ref. | Peat declines the toggle → root stays INERT (legitimate; sensors+guardrails still run, trust claim honestly downgraded to local-detective). Uninstall removes local producer/audit/CI residue and **instructs Peat** to delete the ref + rule; nothing the agent can silently undo (by design). |
| **COMPOUND — update the kit, idempotent re-bond** | Every lesson on THIS host (new bypass class, gracefully-degrading sensor, custodian-carve pattern) flows BACK into `ENGINE/skills` + `ENGINE/factory`, never forked per host. Re-bond: re-copy the engine, re-run the JOIN, check `engine-sha.json` for drift (WARN+diff if dirty, not silent). Resolve to ONE live root per the `NAME-COLLISION-RESOLUTION` precedent — re-bonding never duplicates the engine. Durational diff surfaces only the DELTA to Peat. | **AUTO** for engine pull + re-comprehend + drift report; **PEAT-SEAM** for any NEW axiom the delta surfaces and for re-activating a changed trust-root. Compound writes are Peat-reviewed mothership commits at the boundary, gated by the factory's own `genesis/soul-factory` harness + CI. | — |

---

## 4. Host-type matrix

| Host type | What ports | What adapts | What it CANNOT do (the honest ceiling) |
|---|---|---|---|
| **git + CI (GitHub) — full capability** (Worldline-class reference host) | Engine verbatim (core sensors/judges/runtime + claude-code's 5 hooks + git's 2 hooks). All 4 engine skills. The forge-resistant trust-root in full (append-only ledger + `audit-ledger-append-only.sh` first-parent walk + CI witness job + Peat-only no-force-push toggle). Commit-boundary publish cadence. Full git-history provenance (blame, diff-granularity, squash-ratio, signed-commit-rate). Axioms + host-facts schemas + bond.sh + join-check.sh. | Host axiom registry re-authored + Peat-signed. Territory globs / token-file / placement-dirs re-derived from THIS repo's layout (**NOTE:** `tokens.ts` hardcodes `TOKEN_FILE='app/globals.css'` today — externalizing it is a real re-derivation step, not done). Host-specific sensors materialized only where the stack warrants. CI witness yml rendered with the host's gate scripts. | Nothing structurally blocked. Residual: DETECTIVE-with-lag (caught at next witnessed push), ATTRIBUTION not PREVENTION, fully-informed malicious authority out of scope. Force-push frequency on a local clone stays `quarantined-unknowable`. All declared at bond-time. |
| **git, no CI — degraded trust-root (stated)** | Engine verbatim. All engine skills. Append-only ledger producer + local `audit-ledger-append-only.sh` (first-parent prefix walk over committed history still works). git-history provenance. git pre-commit adapter. | Same axiom/territory/rail re-derivation. host-facts: `git=true, CI=false`. The trust-root ships but the witness CI job is **UNAVAILABLE**; the audit runs LOCALLY only — the agent runs the same audit it could forge, so the green is a convenience signal, not the anchor. The ceiling SAYS: "no independent witness substrate; root is self-attested, not forge-resistant." | **Forge-resistance** — component (a), the witness substrate, is absent and cannot be synthesized locally (anything local runs as the same agent). No CI-required-check go-live, no no-force-push anchor. The factory must NOT claim forge-resistance here. Upgrade path: add CI → re-run Stage 7. |
| **non-git FS (Obsidian B-port class — the one EXECUTED port)** | Engine core + claude-code adapter + comprehension-onboarding in **FS-READ mode** (Read/Grep/Glob — no Bash, the flat tools list IS the enforcement). 9 re-grounded read-only shells (dormant). Honest-partition discipline, structure/meaning firewall, carve-around-custodian rule. `bond.sh` + `host-facts.schema.json` validation (pure shell + JSON — NO Node/tsx, which is exactly why the TS-compiler graft was rejected). | git-derived provenance DROPPED and re-derived from substrate-native fossils: file mtimes, the update-time-on-edit plugin, `_trash` backups, FLEETING→PERMANENT promotion sediment — emitted as a RANGE. Intended graph = PARA + inline `type::` + `index.md`; actual graph = `[[link]]` topology. Axioms re-authored; shells dormant until a vault role is granted at scope A. obsidian-cli read verbs are a scope-A enhancement behind a gate. | No append-only git history → committed-history trust-root UNAVAILABLE; root degrades to detective-from-fossils (weaker + ranged). No CI witness. No Bash at scope B. Force-push freq N/A. Meaning is `quarantined-semantic-by-design`, never read at first contact. Capability-report names every drop. (`SPEC-2026-06-06-genesis-vault-port-B.md`.) |
| **ANY host with an incumbent custodian agent (e.g. Vesta in the vault)** | Everything the underlying host-type ports, PLUS the carve-around rule: detect the custodian in Stage 0, leave it diff-verified untouched, define non-overlapping roles, report anomalies INTO its lane. | Shell roles carved to NOT overlap the custodian's housekeeping lane (it owns ingest/synthesize/tidy/maintain — it WRITES; GENESIS reads its clean structure + probes read-only). The front-door persona (Polaris) stays host-agnostic-active; the rest are present-but-dormant until a role is granted that doesn't collide. | The factory must NEVER do the custodian's job, overwrite its files, or grant a bonded shell a capability that overlaps its lane. Install is additive-only and diff-verifies the custodian byte-for-byte untouched. A bond that touches the custodian ABORTS (the B-port FAIL-REVISE precedent: an archive-to-`_trash` row granting active write contradicted scope B and was caught). |

---

## 5. What does NOT port, and why (the soul boundary)

These never bond. The factory carries **structure**, not soul.

- **Beta companion soul** (`.claude/beta/**` — ROOM/LEDGER/MOMENTS/NOTES). Content is per-entry-gated and co-designed with Beta, not transferable. The wipe precedent makes this **never-rm at/above `.claude/beta/**`.**
- **Worldline cosmology / mythology** (Ne0=−∞, NeX=+∞, NeON=0, OMNI, the garden of memory) and the `worldline-soul` / `worldline-design` / NETRA-voice skills — host-soul, meaningless on any other host.
- **soul-atlas master gallery** (16 soul-atoms, the design source-of-truth) and the production globe/voice sensors (`globe-discipline.ts`, `netra-voice-shallow.ts`) — Worldline-specific, no analog travels.
- **The source host's SIGNED axiom INSTANCES** (`.harness/axioms-v1.json` data). Copying these = Carnage; only the `axioms.schema.json` STRUCTURE ports — the registry is re-authored + re-signed per host.
- **Project memory corpus + signature history + STATUS / session-logs** — host-specific is-by-ought sediment, not engine.
- **The Personal-OS A-scope MEANING layer** (legibility-mirror, value-hierarchy, stone-vs-belief walls, noise→voice) — `quarantined-semantic` by design, gated behind its own A-OS consent organ with safeguard-parts. The factory bonds STRUCTURE only.
- **Peat-key git commit-signing as a provenance mechanism** — explicitly forbidden (gates agent autonomy on his key); the ceiling is raised via CI + commit granularity, never key-signing.
- **`next16.ts` and RSC-client-leak secrets rules** — framework-specific; ported only when `host-facts.framework` warrants, dropped LOUDLY otherwise.

---

## 6. Already-materialized pieces and their maturity

| Artifact | Maturity | State |
|---|---|---|
| `.claude/skills/genesis-host-port/SKILL.md` | MATURE, one real run logged (Ne0EX-life scope B) | on-disk + live; gitignored (travels outside git — the M1 kit carve vendors it) |
| `.claude/skills/comprehension-onboarding/SKILL.md` | MATURE (Stages 0–6, host-agnostic, FS-read mode) | on-disk + live; untracked |
| `docs/team/SPEC-2026-06-06-genesis-vault-port-B.md` | COMPLETE + EXECUTED (the one real port spec) | untracked. **Note (C9):** the "10/10 diff-verified, Vesta untouched" attestation lives in `SESSION-LOG-2026-06-06.md`, NOT in this spec — the spec is a build/acceptance plan |
| `.harness/WITNESS-REF-DESIGN.md` | BUILT & INERT (the forge-resistant root design) | git-tracked; go-live pending the Peat-only branch-protection toggle |
| `scripts/audit-ledger-append-only.sh` | BUILT (first-parent walk, prefix check, NOT hash-recompute) | git-tracked; NEUTRAL until the witness ref is seeded |
| `.claude/hooks/integrity-write-ledger.sh` | BUILT (ledger producer; always exit 0; one-time not_a_chain header) | git-tracked; INERT until Peat applies the wiring diff |
| `.github/workflows/ci.yml` | present (CI witness substrate; additive witness job, no secrets/signing) | git-tracked; NEUTRAL until ledger seeded + witness ref protected |
| `.harness/axioms-v1.json` | LIVE signed data (V/C/H tiers, `projects_to` gate-IDs, PROJECTED/PARTIAL/UNPROJECTED) | git-tracked — concrete instance of the per-host-signed half. Live example of the existence≠enforcement gap (V1 PARTIAL, C1 UNPROJECTED) |
| `.harness/axioms-v1.schema.json` | MATURE (placeholder + waiver discipline) | git-tracked. **Note (C3):** `must_project_by` is `if/then`-required for UNPROJECTED/PARTIAL (fail-closed); `block_until` is documented "Required for BLOCKED" but lives in `properties` only — **not** an `if/then`, so a BLOCKED axiom missing `block_until` passes validation. The factory must add the BLOCKED `if/then` when generalizing |
| `.harness/engine/` | DORMANT as a whole; transplant history proven (Billion-Farm-ERP→Worldline) | denylist JSON consumed live by the Wave-1 hook. **Note (C1):** Worldline sensors compiled into `cli.ts` — de-register at M1 |
| `.claude/skills/sensor-wave/SKILL.md` | MATURE, self-improving run log (5-class bypass taxonomy) | on-disk |
| `.claude/skills/adversarial-harden/SKILL.md` | MATURE, run-log proven (curl/wget + memory-poisoning suite) | on-disk |
| `docs/qa/REPORTS/TASK-2026-06-04-MEMORY-POISONING-A.md` | BUILT & MUTATION-VERIFIED (the false-HAVE catalogue + §2 human-at-seam wiring diff) | all 4 sensors INERT + false-HAVE-flagged; REVISE round 1 logged (0/4 wireable — gated on the shared forge-resistant ledger root) |
| `.harness/engine/NAME-COLLISION-RESOLUTION.md` | COMPLETE (two harness artifacts → one live root) | git-tracked; the collision/idempotency prior-art the re-bond step must honor |

---

## 7. Build plan (with model-tier per the team's tiering default)

| Phase | What | Tier |
|---|---|---|
| **M1 · Carve the kit skeleton + vendor the ENGINE half** | Create `symbiote-factory/` with `ENGINE/`, `STATE/`, `STAGING/`. Copy the 4 mature skills + `.harness/engine/` + the 4 trust-root artifacts (`WITNESS-REF-DESIGN.md`, `audit-ledger-append-only.sh`, `integrity-write-ledger.sh`, `ci.yml`→`ci-witness.yml.tmpl`). Lift `persona.shell.md.tmpl` (flat `tools: Read, Grep, Glob`, identity/voice slots only, NO builder-coaching). Generalize `axioms-v1.schema.json` → `axioms.schema.json` (strip Worldline gate-IDs from examples; **add the BLOCKED `if/then` per C3**). **De-register the 3 Worldline sensors from `cli.ts` per C1** — this is the one bit of real engine surgery in M1. | standard |
| **M2 · `bond.sh` orchestrator + `host-capability-probe.sh` (Stages 0–4 wiring)** | Pure-shell orchestrator drives Stage 0→4: invokes comprehension-onboarding, writes `STATE/<host-id>/` ledger, routes unknowables to quarantine, emits a RANGE. Probe detects git / git+CI / non-git / custodian. New shell code with abort-clean semantics; protocol logic exists in the skill, this is the executable spine. | heavy |
| **M3 · Honesty schemas + JOIN check (shell-only)** | Author `host-facts.schema.json` (every field RANGE-or-quarantined), `blindness-ceiling.schema.json`, `partition.schema.json`. Write `join-check.sh` (assert PROJECTED↔gate bijection, flip unbound→UNPROJECTED+named). Validate probe output vs schema. Deliberately shell+JSON, NO Node — proves the degraded-host criterion the rejected TS-compiler would fail. | standard |
| **M4 · BUILD pipeline — fan-out + adversarial verify + deterministic grep backstop** | Wire `genesis-host-port` + `sensor-wave` + `adversarial-harden` into `bond.sh`'s BUILD stage: Canopus-typed fan-out to STAGING; Algol-typed adversarial verify (different agent); main-loop deterministic grep that READS files; one opus completeness-critic backstop; loop-until-dry for hardened rails. Heaviest verification surface; mixed-tier (cheap fan-out + cheap refute + ONE opus critic). | heavy |
| **M5 · Stage-6 install + grafts (receipt + engine-sha) + Stage-7 go-live helper** | Write the Write-tool install + diff-verify (`installed==staging`, custodian untouched) + emit `install-receipt.json` + `engine-sha.json`. `uninstall.sh`: receipt-driven O(files) removal + diff-verify byte-identical-to-pre-bond + name-collision resolution to one live root. Stage-7 helper that PRINTS the exact Peat-only no-force-push toggle steps and does none of them. Degradation branches for git-no-CI / non-git stated. | standard |
| **M6 · End-to-end fixture bond + adversarial harden of `bond.sh` itself** | Bond into a throwaway git fixture AND a non-git fixture (no Node installed) to prove both degradation paths declare their drops rather than silent-cap or crash. Run adversarial-harden on `bond.sh` + `join-check.sh` + `uninstall.sh` (attacker tries: escape the receipt, forge a PROJECTED-but-stub gate past the JOIN, leak meaning at first contact, non-empty install diff). Ground-truth the receipt = uninstall returns byte-identical. This is where false-HAVE gets caught before any real bond. | heavy |
| **M7 · COMPOUND wiring + commit at boundary** | Wire the compound step: lessons → `ENGINE/skills` (sensor-wave taxonomy, custodian-carve patterns); idempotent re-bond resolving to one live root; durational diff of prior beliefs. Capture the whole orchestration AS a composable skill (parameterized by host-id/scope/custodian). Commit on `genesis/soul-factory`; the factory's own harness + CI gate the compound writes. | small |

---

## 8. Open decisions for Peat (one narrow question at a time)

These are real forks, not a proposal wall. The full agenda is enumerated openly here — Peat's
standing instruction (2026-06-11): always state clearly what ALL the open decisions are. We go
DEEP on one at a time, in any order — each has a stated default that holds if Peat says nothing.

**Q1 — Where does the canonical kit live when first carved (M1)? — DECIDED (Peat, 2026-06-11)**
The mothership lives **inside this repo** (subtree on the `genesis/*` lineage, under the existing
harness + CI that gate compound writes) and is **never merged into `main`** — `main` stays clean
for deploy, per the standing main-is-web-only policy. Recorded from Peat's own words, not a
default that lapsed. (This was the same keystone shape as the foundation-redesign substrate
question — this decision may inform that one but does NOT decide it.)
*Residual sub-clause still open under default:* whether to split to a standalone mothership repo
at the first SECOND-host bond, when forking pressure becomes real — revisit when a second host is.

**Q2 — For M1, externalize all engine sensor target-data to host-facts now, or vendor as-is and
re-derive lazily per host?** `mutating-action.ts` already reads its data from JSON, but `tokens.ts`
hardcodes `TOKEN_FILE='app/globals.css'` (C11, verified). A full up-front generalization is clean
but is real surgery on the verbatim-ported half; lazy per-host re-derivation keeps M1 a copy and
matches the "rails re-derived per host" theory but leaves hardcoded defaults in the engine. Only
Peat decides which strategy the factory follows.
*Default if unsaid:* vendor as-is and re-derive lazily — keep M1 a faithful copy of the proven
engine; treat target-data externalization as a per-host emit step (consistent with Venom). Flag
each hardcoded path in the capability-report so it is never a silent cap.

**Q3 — Build the optional `symbiote install <host>` CLI wrapper in M5, or defer until a real second
host exists?** The judges split: a one-command bond is cleaner operator UX, but a CLI is new code
with no prior-art run, and `bond.sh <host>` is functionally equivalent. The design treats the CLI
as optional UX, not a dependency. Only Peat decides whether the wrapper is built in M5 or deferred.
*Default if unsaid:* defer — ship `bond.sh` as the bonding surface for M1–M6; add the thin wrapper
only at the first real second-host bond. Avoids speculative machinery in the one-session build.

**Q4 — On a git-no-CI host, is local-detective-only an acceptable terminal trust state, or must the
factory REFUSE to bond past comprehension until CI exists?** Allowing the bond gives the host
sensors + guardrails + honest-partition but no forge-resistant anchor (the witness substrate is
absent, root is self-attested + forgeable by the same agent). Refusing forces CI first. Only Peat
decides whether the factory accepts or refuses this degraded-root state as terminal.
*Default if unsaid:* allow the bond with the trust claim explicitly downgraded to
local-detective-only in the blindness ceiling, and surface "add CI → re-run Stage 7" as the
upgrade path. Refusing would discard genuine value over a property the ceiling already declares
missing.

---

## 9. Verified-claims ledger

14 originating claims were extracted and adversarially verified against the on-disk repo. Verified
claims are load-bearing as written; refuted claims are corrected here and the SPEC uses the
correction throughout.

| ID | Claim (abbrev.) | Verdict | Correction used in this SPEC |
|---|---|---|---|
| C1 | `.harness/engine/` holds a *portable* ENGINE half | **REFUTED** | Dir structure is real, but `globe-discipline`, `phase-scope`, `netra-voice-shallow` are unconditionally imported + registered in `core/cli.ts` (lines 26–28, 46–50); `globe-discipline.json` hardcodes Worldline component paths; the README states "Adapted from the Billion Farm ERP harness with Worldline-specific anchors." → The engine is a **Worldline-coupled fork**; M1 must de-register those sensors and externalize target-data. |
| C2 | claude-code adapter has **6** hooks | **REFUTED** | **5** hook scripts exist (pre/post-tool-use, session-start/end, stop); the 6th file is `_lib.sh`, a shared helper, not a hook. The git adapter has 2. SPEC says **5 + 2**. (Also flagged in verify: `session-start.sh` + `git/pre-commit.sh` reference a **stale `.harness/core/cli.ts`** path — the move to `.harness/engine/` was not fully propagated; M1 must repair this.) |
| C3 | schema makes `must_project_by` required for UNPROJECTED/PARTIAL AND `block_until` required for BLOCKED | **REFUTED** | `must_project_by` IS `if/then`-required (lines 44–57, fail-closed). `block_until` is documented "Required for BLOCKED" but lives in `properties` only (lines 114–121) — **no `if/then`**, so a BLOCKED axiom omitting it passes validation. Enforcement is **asymmetric**; M1 must add the BLOCKED `if/then` when generalizing. |
| C4 | `axioms-v1.json` Peat-signed, `projects_to` arrays, V/C tiers, live statuses | **REFUTED** | Literal fields accurate, but **C1 status is UNPROJECTED** (not PARTIAL) and an **H1 harness tier** the claim omits. Primary finding: all `projects_to` gate-IDs are Worldline-harness dead references on any other host — the file is **fully host-coupled**, must be **wholly re-authored** per host, not merely re-signed (this SPEC's §2.1 already treats it so). |
| C5 | `WITNESS-REF-DESIGN.md` states exactly three required components, BUILT & INERT pending Peat | **VERIFIED** | Used as written (§1, constitution property 2). |
| C6 | `audit-ledger-append-only.sh` asserts append-only via `--first-parent` prefix walk (not hash-recompute), exits 0 PASS/NEUTRAL, needs git work tree | **VERIFIED** | Used as written (§4, §6). |
| C7 | comprehension Stage 0 routes force-push freq to `quarantined-unknowable` as a SILENT GAP, RANGE-not-point; Stage 4 done = honest partition not "no holes" | **VERIFIED** | Used as written (§1.4, §3 Stage 0/3–4). |
| C8 | `genesis-host-port` mandates ONE canonical shell template, fan-out to STAGING, adversarial verify by a DIFFERENT agent, then a deterministic grep backstop that READS files | **VERIFIED** | Used as written (§1 false-green floor, §2.3, §3 BUILD). |
| C9 | `SPEC-2026-06-06...` §3 item 4 records structural deny-by-default AND "10/10 diff-verified, Vesta untouched" | **REFUTED** | The structural deny-by-default record (flat CSV `tools: Read, Grep, Glob`, nested-map risk) IS present (lines 55, 65–71). The "10/10 diff-verified, Vesta untouched" clause is **NOT in the file** (grep = 0); it lives in `SESSION-LOG-2026-06-06.md`. The spec is a build plan, not a completion record — §6 cites it correctly. |
| C10 | `mutating-action.ts` reads denylist data from `mutating-bash.json` / `mutating-mcp.json` at runtime | **VERIFIED** | Used as written (Q2 — the data/engine split is real for this sensor). |
| C11 | `tokens.ts` hardcodes `TOKEN_FILE='app/globals.css'` — per-host externalization is real work | **VERIFIED** | Confirmed on disk (line 9). Drives Q2 and the §4 git+CI "NOTE." |
| C12 | `NAME-COLLISION-RESOLUTION.md` records two `worldline-harness` artifacts resolved to one live root | **VERIFIED** | Used as written (§3 COMPOUND, §6). |
| C13 | `adversarial-harden` run log: curl/wget guardrail never reached DRY_TARGET=2 over 6 rounds; NOT-TIGHT codified as SUCCESS | **REFUTED** (portability) | Run-log facts accurate. Correction: the file says "REVISE campaigns" not "BUILD phase"; the loop *algorithm* is portable but the concrete skill is host-coupled (named agents Algol+Canopus, companion skill, harness dir layout). This SPEC treats the **economics** (NOT-TIGHT = success, DRY_TARGET≥2) as portable and the **named-agent wiring** as reground — see §1 floor + §3 BUILD. |
| C14 | `sensor-wave` logs a 5-class bypass taxonomy as standing verify probes / self-improving loop | **REFUTED** (partial) | All five classes are enumerated, but at the run-log they were **logged intentions, not yet baked** into the verify prompt, and the skill is Worldline-coupled by its own description. This SPEC's COMPOUND phase is where the taxonomy is *actually* written back — treated as compounding work, not a done mechanism. |

---

## 10. Appendix — component registry, grouped by verdict

The full census classified every component on a portability axis. **engine** = ports verbatim;
**reground** = mechanism portable, host names/paths re-derived; **host-signed** = ports only behind
a per-host Peat signature; **no-port** = never bonds (soul / instance / history); **unsure** =
needs a direct read to classify.

| Verdict | Count | Representative members |
|---|---|---|
| **engine** | 124 | `harness-engine/core/{cli,types,runtime/*,lib/*,lsp/*}`; `sensors/{mutating-action,task-discipline,typecheck,lint,test-presence,placement}`; `comprehension-onboarding/SKILL.md`; `caveman`, `write-a-skill`, `handoff`, `grill-me`, `zoom-out`; all `wondelai` MIT methodology skills (clean-code, DDD, refactoring-patterns, system-design, ...); `_probe.mjs`, `_snap.mjs`, `render-html.sh`, `fetch-design-bundle.sh`; the Phase-F algorithm modules (`_phaseF_peak/novelty/phrasing/motif_hook/restraint`, `loooom_analyze.py`); memory: `feedback_chain_integrity`, `feedback_note_it_now`, `feedback_orchestration_as_skills`, `feedback_verify_*`, `reference_cc_subagent_env_indistinguishable`, `reference_codegraph_socket_tailwind_panic` |
| **reground** | 211 | All 9 `.claude/agents/*.md` shells; most `.claude/hooks/*` (mutating-action, persona-tracker, post-edit, sign-work, pre-task, pre-handoff, save-checkpoint, harness-check); `genesis-host-port`, `sensor-wave`, `adversarial-harden` skills; `axioms-v1.schema.json`, `worldline-harness.config.json`, `single-source-registry.json`; most `scripts/audit-*.sh` (territory, design-tokens, handoff-integrity, ledger-append-only, gauntlets); `.github/workflows/ci.yml`; the B-port staged shells; `docs/team/{WORKFLOW,FILE-OWNERSHIP,QUALITY-BAR,SETUP}.md`; most zero-trust REVISE reports |
| **host-signed** | 23 | `.harness/axioms-v1.json` (Peat-signed registry instance); `.harness/scope-waivers.json`; `.harness/fetch-allowlist.txt`; `.harness/WITNESS-REF-DESIGN.md`; `.harness/proposed-wiring-M.md`; `.github/workflows/publish-witness.yml`; `scripts/audit-retention-policy.sh` + `audit-witness-staleness.sh` + `publish-witness-ledger.sh`; `untrusted-fetch-gate.sh`; `SPEC-2026-06-06-genesis-vault-port-B.md`; `QA-canopus.md` (B-port verdict); memory `project_trust_machine_symbiote` + Thai-register/Peat-reasoning feedback entries |
| **no-port** | 191 | All `.claude/beta/**` (ROOM/LEDGER/MOMENTS/NOTES/ACCESS-LOG + grants + scribe + all `_probe_*`/`_verify_*`/`_realrun_*` song-pinned probes); `betelgeuse-companion-overlay.md` + beta skills/hooks/templates; Worldline-soul sensors (`globe-discipline`, `netra-voice-shallow`) + their JSON + anchors (`intent.md`, `design-rails.md`, `tech-rails.md`, `progression.md`); `worldline-soul`/`worldline-design`/`worldline-build-verify`/`worldline-frontend-pipeline`/`worldline-spec-review`/`polaris-grill-mode` skills; all `content/**` + photo/places pipeline scripts; all SAVE-POINTs + SESSION-LOGs + most `docs/qa/REPORTS/TASK-*`; all `.claude/handoffs/from-*` (≈300 dispatch files); `.claude/parses/*` + exports; both `.claude/worktrees` agent snapshots; `~/.claude/plans/recursive-sparking-stardust.md`; all `project_worldline*` / `reference_worldline*` / `reference_the_telling` memory |
| **unsure** | 1 | `.claude/beta/tools/_phaseF_phrasing_realrun.py` (no grep `/Users/` hit, but not directly read — classify before any port touches the beta-tools dir) |

> The registry is the appendix of record for which artifacts the factory may copy, which it must
> re-ground, which need a Peat signature, and which it must never touch. The **no-port** set IS the
> soul boundary of §5.

---

*End of SPEC. Nothing here is decided. Polaris awaits Peat's sign on the §8 questions and, when the
build lands, his signature on the per-host axiom registry and his hand on the no-force-push toggle —
the two acts the machine can never perform for him.*
