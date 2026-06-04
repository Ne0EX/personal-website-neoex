# docs/qa/REPORTS/M-REVISE-R4-OPUS-BACKSTOP.md

## task · REVISE round 4 — OPUS go-live gate for T2 (memory-poisoning detective trust-root)
## auditor · Algol · α-VER-06 (opus backstop)
## date · 2026-06-04
## mode · build+validate verdicts adjudicated against the actual source files (read, not re-run); self-reports not trusted as proof — the source is the proof
## verdict · 3-of-4 R3 CODE BLOCKERS CLOSED · 1 STILL OPEN (publisher exists but ships a NEW false-green) · NOT CLEARED FOR GO-LIVE

---

## scope honored
- Read-only on every script/wiring file. No script modified by this audit.
- No Bash/git run (the mutating-action gate blocks `git merge-base` / `>` redirects and a prior run looped here). Adjudication is by reading the delivered source against the validate evidence.
- `settings.json` / `.claude/beta/**` never read or touched. No commit / push / ref created.
- Only durable artifact: this report.

---

## Q1 — Are the R3 CODE blockers actually closed, proven by source + validate evidence?

The R3 critic (M-REVISE-R3-OPUS-BACKSTOP.md §Q4) named three CODE blockers — (1) `--seed` absent, (2) recurring publisher absent, (3) M3 matcher stale — plus the M1 within-session WARN caveat. Adjudicated one by one.

### (1) `--seed` mechanism — CLOSED. Proven in source.
`.claude/hooks/integrity-write-ledger.sh` now implements `--seed`:
- **`--seed` detected before `cat`** (lines 71-95): `_SEED_MODE="${1:-}"` read at top; the stdin branch is gated by `if [[ "$_SEED_MODE" == "--seed" ]]` so stdin never blocks on a terminal. Closes the R3 finding that the producer "parses zero arguments."
- **All functions precede the seed dispatch** (`canonical_path`, `ensure_ledger_header`, `ledger_append` defined lines 101-280; seed dispatch lines 297-436) — no forward-reference.
- **Idempotency** via `seed_already_recorded()` (lines 304-321): grep-F on `"path":"…"` then `"sha256":"…"`; same (path, sha256) → skip. Matches the verdict's "second `--seed` run adds zero entries when files unchanged."
- **AUTHOR_MATCH for handoffs** (lines 392-409): author derived from the `from-<agent>` directory segment (`handoff_author="${dir_seg#from-}"`), passed to `seed_one` as the override author — satisfies M1 assertion (b) (dir-agent == ledger-author). Signatures/MEMORY.md use `SEED_AGENT` default (M1 does not check author there).
- **Beta exclusion** enforced in both handoff (line 396) and signatures (line 418) walks.
- **Canonical paths** match M1's index: `canonical_path()` returns absolute for auto-memory, repo-relative (no `./`) for in-repo surfaces.
- **Normal stdin path unchanged** (lines 438-475).

Validate evidence corroborates source (reRefute `/tmp/r4-rerefute-seed.sh`, 15/15 PASS):
- **S3 (the live blocker):** seed h1 only, h2 unrecorded on disk, M1 wired → **exit 4 UNVERIFIABLE_PRESENT** — the blocker fires.
- **S4:** re-seed captures h2, M1 wired → **exit 0**, `unlisted_on_disk=0` — blocker CLOSED.
- **S1:** `--seed` exit 0; handoffs×2 (author=polaris/sirius from dir segment), sig×1, MEMORY.md×1; beta excluded.
- **S5:** idempotency — re-seed unchanged tree, line count 54→54.
- **S7a/S7b:** normal stdin path still records / skips correctly.

**Crucially, the R3 "false-have" is repaired at the source.** `audit-handoff-integrity.sh:456` previously advertised a `--seed` command that did not exist. The flag now exists, so line 456's remediation text (`integrity-write-ledger.sh --seed`) is now a true-have, not a false-have. **CLOSED.**

### (3) M3 matcher stale — CLOSED. Proven in source.
`.harness/proposed-wiring-M.md` §M3 now carries the broadened egress-class matcher at **both** JSON blocks (line 338 standalone snippet, line 393 full PreToolUse array):
```
WebFetch|WebSearch|mcp__claude_ai_.*|mcp__plugin_supabase_supabase__.*|mcp__plugin_vercel_vercel__.*|mcp__playwright__browser_(navigate|navigate_back|network_request|tabs|evaluate|run_code_unsafe|fill_form|drop)$|mcp__plugin_chrome-devtools-mcp_chrome-devtools__(navigate_page|new_page|evaluate_script|lighthouse_audit|performance_start_trace)$
```
This matches `mcp__claude_ai_Notion__notion-fetch` (via `mcp__claude_ai_.*`) and `mcp__playwright__browser_navigate` (via the playwright alternation) — exactly the MCP egress tools the R3 critic showed the stale `WebFetch|WebSearch` matcher would NOT fire on. The MATCHER FIX preamble (lines 177-218) documents the R3 chain-integrity desync, the SAFE-WIRING BOUND (no catch-all, lines 192-197), the self-check, anchoring-robustness note, and the Mermaid side-effect callout for Peat.

Validate evidence corroborates (reRefute `/tmp/r4-rerefute-m3-matcher.sh`, 70/70 PASS): matcher extracted from the file via `python3 json.loads`; 23 egress tools MATCH; **StructuredOutput / SendUserFile / advisor → NO-MATCH** (brick check); 13 built-ins + 15 non-egress playwright + 9 non-egress chrome-devtools + 5 computer-use → NO-MATCH. **CLOSED.**

### (M1 within-session WARN caveat) — CLOSED. Proven in source.
`scripts/audit-handoff-integrity.sh` splits APPEND_ONLY (lines 308-333):
- `distinct_sha_count >= 3` → `add_failure` (exit 1 — sustained churn). (line 325)
- `distinct_sha_count == 2` → `WARN_COUNT++` + WARN emit; **does NOT call add_failure**, so it cannot change the exit code. (lines 328-332)
- A tamper layered on a 2-sha re-edit still exits 1 via the (a) SHA_MATCH check (lines 344-347), which runs unconditionally after the WARN branch.
- `warned=N` surfaced in SUMMARY (line 430). Header comments for (c) updated in PURPOSE (lines 13-16), MULTI-ENTRY SEMANTICS (lines 52-60), and EXIT CODES (lines 62-68).

Validate evidence (reRefute `/tmp/r4-rerefute-m1-warn.sh`, 8/8 PASS + mutation suite 18/18 PASS exit 0): W1 (2-sha disk=latest → exit 0 + WARN), W2 (3-sha → exit 1), W3 (2-sha disk≠latest tamper-on-top → exit 1 SHA_MISMATCH, WARN still emitted). No regression in the 18-case mutation suite. **CLOSED.**

### (2) recurring publisher — **NOT CLOSED.** The publisher now EXISTS, but ships a false-green.
The R3 blocker was worded "the recurring publisher does not exist." That *absence* is closed — `scripts/publish-witness-ledger.sh` (S1), `scripts/audit-witness-staleness.sh` (S3), and `.github/workflows/publish-witness.yml` are now present. But the go-live question is not "does code exist," it is "does it ship a green that is true." It does not.

**The deployed staleness-monitor job is mis-wired and false-greens.** `.github/workflows/publish-witness.yml:150` checks out the genesis branch with `fetch-depth: 1` for the `staleness-monitor` job. Under a depth-1 clone the tip commit is the shallow boundary and appears parentless, so `audit-witness-staleness.sh` S5 (`git log -1 --format=%ct -- <ledger>`, line 228) returns the **tip commit's** date for any path, not the **ledger-delta's** date. The monitor therefore measures "time since the most recent commit of any kind," not "time since the ledger went unwitnessed." In any active repo, a code-only commit newer than a dark ledger delta makes the monitor report HEALTHY.

This is reproduced empirically in the validate evidence (publisherRefute, `tests/harness/witness-publisher-refute-Tb-shallow-discriminator.sh`, exit 1 = bug reproduced by design): a **2-day-old (172800s) unpublished delta** with a code-only tip dated now was reported **HEALTHY exit 0, `delta_age_seconds=1`** against the 86400s cadence. A dark publisher hiding a days-old delta stays SILENT — the exact T-b failure the monitor exists to prevent.

The publisherRefute verdict itself records `closed:false`, `any_bypass_remains:true`, `wireable_now:false`. A go-live gate cannot clear a trust-root whose own validate evidence reports a live bypass. **OPEN.**

> Note: the publisher's append-only correctness (S1 / `audit-ledger-append-only.sh` reuse) and T-a FORGE-VIA-PUBLISHER / T-d TOKEN-SCOPE *are* proven by publisherRefute (T-a CAUGHT given branch-protection wired, T-d HOLDS). The single open code item is the staleness-monitor liveness arm.

---

## Q2 — Did closing any blocker open a NEW false-green?

**Yes — one, and it is the worst class (a liveness alarm that affirmatively reports "fine" while the thing it guards is dead).**

Closing blocker #2 (building the publisher + the S3 staleness monitor) introduced the T-b false-green above: the detector that exists to catch a dark publisher reports **HEALTHY exit 0** whenever a non-ledger commit is newer than a dark ledger delta — i.e. in any active repo. Empirically: 172800s-old delta → `delta_age_seconds=1` → HEALTHY. Root cause: `staleness-monitor` checkout `fetch-depth: 1` (publish-witness.yml:150) starving the `git log` age computation in audit-witness-staleness.sh:228.

The other two newly-landed fixes did NOT open false-greens, checked explicitly:
- **Seed mis-seeding:** ruled out. Handoff author comes from the `from-<agent>` dir segment (not `WL_AGENT`/`seed`), so a seeded handoff does not green a forged AUTHOR_MATCH; beta is excluded; idempotency does not collapse two distinct on-disk states (S5). The S3/S4 discriminator proves the seed makes the M1 blocker fire then clear correctly.
- **M3 matcher accidentally matching a built-in:** ruled out. 70/70 — StructuredOutput / SendUserFile / advisor / Read / Write / Edit / Bash / computer-use / non-egress playwright + chrome-devtools all NO-MATCH. The broadened matcher does not brick the harness, and the SAFE-WIRING BOUND forbids the catch-all that would.
- **M1 WARN suppressing a real tamper:** ruled out. W3 shows a tamper on top of a 2-sha re-edit still exits 1 via SHA_MATCH; the WARN branch only suppresses exit for the benign 2-sha case.

---

## Q3 — Remaining go_live_seam_steps (Peat-only) in SAFE WIRE-ORDER

These are the human-at-seam toggles. **None of these is a code blocker** — they are pure Peat actions, listed in the order that prevents a false-green from shipping. The CODE prerequisite, where one exists, is named per step.

1. **Run the one-time baseline seed.** `WL_AGENT=… bash .claude/hooks/integrity-write-ledger.sh --seed` to populate `.harness/integrity-ledger.jsonl` for every pre-existing GENESIS memory file, then commit it. — *Code prereq satisfied THIS ROUND (blocker #1 closed). No remaining code prereq.* MUST be first: M1-wired exits 4 on every unseeded handoff.

2. **Wire the producer + guard in settings.json (§2a), ledger BEFORE guard.** Insert `integrity-write-ledger.sh` then `integrity-write-guard.sh` ahead of `write-protect-beta.sh` in the PostToolUse `Write|Edit|MultiEdit` chain (proposed-wiring-M.md §"Hook ordering"). — *No code prereq (producer + guard code-complete and inert).* Order after the seed so the first hook-routed writes append onto a seeded baseline.

3. **Set `WL_INTEGRITY_WIRED=1` and wire M1/M2 rails in WARN-mode.** M1 must run WARN (not BLOCK) on exit 3/4 and M2 WARN on exit 5 until the seed + one handoff cycle have accumulated. — *No code prereq.* MUST come after the seed (step 1), or M1 exits 4 on every unseeded handoff. (The within-session 2-sha case is now WARN, not a block — caveat closed this round.)

4. **Create `refs/heads/integrity-witness`** from the genesis-branch tip. — *No code prereq. Peat can do this now.*

5. **Enable branch-protection-no-bypass (block force-push / block deletions / require-linear-history) on the witness ref.** — *No code prereq. Peat can do this now.* **THIS IS THE LOAD-BEARING TOGGLE.** Until it is ON, component (c) of the trust-root is absent and the append-only witness green witnesses forgeable history — the witness green MUST NOT be trusted as an anchor before this is set (T-a holds ONLY given this; publisherRefute confirms). This is a wire-order hazard, not a code defect.

6. **Grant `contents:write` scoped to the witness ref + enable the publisher workflow.** — *No code prereq for the publisher's append-only arm (S1 proven).* **CAVEAT:** the S3 staleness-monitor arm of this same workflow carries the open code blocker below — do not rely on its HEALTHY signal until the fetch-depth fix lands. Branch-protection (step 5) must be ON before this so the granted token can only ff-advance the protected ref.

7. **Wire the M3 PreToolUse matcher in settings.json** using the broadened egress-class regex from proposed-wiring-M.md §M3 (lines 338/393). — *No code prereq (matcher corrected this round).* Independent of the ledger chain; can be wired any time. Also add allowlist domains to settings.json `allow` to suppress the WebFetch prompt (per §M3 note).

8. **Wire M4 retention + remaining rails.** Create `.harness/retention-policy.json` with `cleanupPeriodDays > 0` (or sign a scope-waiver), then wire `audit-retention-policy.sh` as a rail. — *No code prereq (M4 audit code-complete; current RED reflects the real undeclared-policy gap, fails closed).*

**Steps Peat can do NOW with no dependency on this round:** 4 (create ref), 5 (branch-protection), 7 (M3 matcher), 8 (M4 policy file). **Steps gated on THIS round's now-closed code:** 1 (seed — needs the `--seed` flag, now present), 3 (M1 WARN-mode — needs the 2-sha WARN split, now present). **Step 6 (publisher enable) is gated on the OPEN code blocker below for its liveness arm.**

---

## Q4 — cleared_for_go_live

**FALSE.** One CODE blocker remains. Per the gate's own definition ("true ONLY if zero code blockers remain and the only thing left is Peat-seam steps"), the boolean is forced false.

### go_live_code_blocker (remaining)
**T-b staleness-monitor shallow-clone false-green.** `.github/workflows/publish-witness.yml:150` checks out the `staleness-monitor` job with `fetch-depth: 1`. `audit-witness-staleness.sh:228` (`git log -1 --format=%ct -- <ledger>`) then reads the shallow-boundary tip date, not the ledger-delta date, so the monitor reports HEALTHY (`delta_age_seconds=1`) when the publisher is dark and a code-only commit is newer than a days-old unpublished delta. Reproduced empirically (172800s delta → HEALTHY). **FIX (one line, CODE, owner Canopus):** set the staleness-monitor checkout to `fetch-depth: 0` (matching the publisher job), OR source the delta age from the already-fetched witness-tip publish date instead of `git log` over a shallow genesis checkout. REVISE → Canopus (his `publish-witness.yml`). This is a code edit — no Peat-seam step touches it — so it gates clearance.

### NOT in the code-blocker list (kept sharp on purpose)
- **branch-protection-no-bypass** is a **Peat-seam wire-order hazard** (step 5), NOT a code blocker — it is a human toggle. It belongs in the seam ordering ("do not trust the witness green until it is ON"), not in `go_live_code_blockers`.
- **M1 2-sha WARN**, **--seed false-have**, **M3 stale matcher** are CLOSED this round (see Q1) and are no longer false-greens.

---

## false-greens remaining
1. **T-b staleness-monitor reports HEALTHY while the publisher is dark** — `publish-witness.yml:150` `fetch-depth: 1` + `audit-witness-staleness.sh:228` `git log` over a shallow checkout. The liveness alarm affirmatively says "fine" in any active repo when the publisher has gone dark; empirically a 172800s-old unpublished delta read as `delta_age_seconds=1` HEALTHY. Worst class: a dead-man's switch that lies. (= the open code blocker.)
2. **trust-root-if-wired-without-branch-protection** (carried from R3, unchanged) — the append-only witness green is an anchor ONLY over a force-push-protected ref. If the rail/CI green is trusted before seam-step 5 is ON, the green witnesses forgeable history. Mitigated by wire-order (step 5 before step 6), not by code; remains a hazard until the toggle is set.

NOT false-greens (closed this round): M1 chain-strip (honestly disclaimed + re-homed in the trust-root, R3-proven); M1 2-sha within-session (now WARN); M4 trailing-newline (false-RED, fails closed); `--seed` remediation text (flag now exists).

---

## recommendation
Three of the four R3 CODE items — the `--seed` mechanism, the M3 egress-class matcher, and the M1 within-session WARN split — are **real and proven against the delivered source and the reRefute validate evidence (15/15 + 70/70 + 8/8 + mutation 18/18)**. PASS these three back to Polaris as verified-closed. The R3 `--seed` false-have at `audit-handoff-integrity.sh:456` is repaired (the flag it advertises now exists).

The fourth — the recurring publisher — has gone from *absent* to *present-but-incorrect*. The publisher's append-only arm (S1) and its T-a/T-d defenses are proven, but the S3 liveness monitor as deployed ships a worst-class false-green (HEALTHY while dark) due to a one-line `fetch-depth` mis-wire. **Hold T2 go-live.** REVISE → Canopus: fix `publish-witness.yml:150` `fetch-depth: 1 → 0` (or re-source the delta age off the witness-tip publish date). It is a single code edit, owner Canopus, blocking nothing on the seam — so it is the one CODE blocker between here and a clean single-Peat-toggle go-live.

Once that one line lands and re-refutes green, the remaining path is **pure Peat-seam in the order in Q3** — and branch-protection (step 5) must be the hard precondition for trusting any witness green, sequenced before the publisher is granted its token (step 6). **cleared_for_go_live = false** until the T-b fetch-depth fix closes.
