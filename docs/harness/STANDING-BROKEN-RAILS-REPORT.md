# Standing Broken Rails Report

Owner: Canopus (α-HRN-07)  
Slice: Phase 0 · 0.7  
Date: 2026-06-10  
Task reference: Phase-0-slice-0.7

---

## MECHANICAL-FIXED

### FIX 1 — `proto_dirs[@]` and `found[@]` unbound variable in `scripts/audit-prototype-runtime.sh`

**Rail affected:** `prototype-runtime`

**Root cause:** The script runs under `set -euo pipefail`. The `collect_prototypes()` function declares `local proto_dirs=()` (array) and `local found=()` (array). Under bash 3.2 (macOS system bash), `"${array[@]}"` expansion on an empty array is treated as an unbound variable when `set -u` is active, raising `bash: proto_dirs: unbound variable` or `bash: found: unbound variable`.

Two call sites were affected:

- Line 147 (original): `deduped=$(printf '%s\n' "${proto_dirs[@]}" | sort -u | ...)`  
  Hit when a task has changed files but none match `prototypes/*/*` or `.claude/visual-diffs/*/prototype/*`.

- Line 171 (original): `printf '%s\n' "${found[@]}"`  
  Hit whenever `found` remains empty (no index.html located).

**Effect before fix:** Every non-prototype task caused the rail to exit with an unbound-variable error rather than the intended exit 2 (SKIP). This is a false-RED — the rail was blocking work that had no prototypes in scope.

**Fix applied:**

```bash
# proto_dirs guard (line ~147)
if [[ ${#proto_dirs[@]} -eq 0 ]]; then
  deduped=""
else
  deduped=$(printf '%s\n' "${proto_dirs[@]}" | sort -u | grep -v '^$' || true)
fi

# found guard (replaces printf '%s\n' "${found[@]}")
if [[ ${#found[@]} -eq 0 ]]; then
  printf ''
else
  printf '%s\n' "${found[@]}"
fi
```

**Verification:** `WL_TASK_ID=T bash scripts/audit-prototype-runtime.sh` on a branch with only non-prototype changed files now exits 2 (SKIP) with no unbound-variable error. The SKIP-is-not-a-failure semantics (exit 2) are preserved per the script's exit-code contract.

**Files changed:** `scripts/audit-prototype-runtime.sh`

---

### FIX 2 — harness-check.sh does not export `WL_TASK_ID` to child check scripts (`.claude/hooks/harness-check.sh`)

**Rail affected:** `audit-ground-truth-observed` (confirmed); any other rail whose check script reads `WL_TASK_ID` from env.

**Root cause:** `harness-check.sh` computes its task id on line 18:

```bash
TASK_ID="${WL_TASK_ID:-adhoc-$(date +%s)}"
```

It then invokes each rail's check script as:

```bash
output=$("$check" 2>&1)
```

Neither the resolved `TASK_ID` nor `WL_TASK_ID` was exported to the child process environment. `audit-ground-truth-observed.sh` reads its task id as positional `$1` with an env fallback:

```bash
TASK_ID="${1:-}"
if [[ -z "${TASK_ID}" ]]; then
  TASK_ID="${WL_TASK_ID:-}"
  if [[ -z "${TASK_ID}" ]]; then
    exit 5   # usage error
  fi
fi
```

Because neither `$1` nor `WL_TASK_ID` was available in the child, the script exited 5 (usage/invocation error) on every run. harness-check treated any non-zero exit as FAIL, producing an artificial RED on every run of the `audit-ground-truth-observed` rail regardless of whether the task actually had observed artifacts.

**Why positional arg was NOT used:** Several rail scripts interpret `$1` as non-task-id values:

| Script | `$1` meaning |
|--------|--------------|
| `audit-axiom-gate-join-coverage.sh` | `TODAY_ISO` (date override) |
| `audit-gauntlet-overlap.sh` | `PAGE_URL` |
| `audit-search-index-completeness.sh` | `--verbose` flag |
| `audit-gauntlet-min-legible.sh` | `--verbose` flag |

Passing `TASK_ID` as `$1` would silently misinterpret it as a date or URL in at least two scripts, causing incorrect but non-obvious failures. The env export approach is the correct minimal fix.

**Fix applied:**

```bash
# After line 18 in harness-check.sh
export WL_TASK_ID="${TASK_ID}"
```

**Verification:** With `WL_TASK_ID=TASK-FIX2-VERIFY` set, `audit-ground-truth-observed` now receives `TASK_ID=TASK-FIX2-VERIFY` via env, runs its actual logic (exits 2 because the manifest for that task doesn't exist — a real task-specific miss, not exit 5 from missing arg), and harness-check correctly marks it FAIL on that real assertion rather than on the usage error. A stub check returning exit 1 still marks the rail FAIL (fail-closed preserved).

**Files changed:** `.claude/hooks/harness-check.sh`

---

## INVESTIGATED-ONLY

No code edits were made for either item below. No blind fixes applied.

---

### INVESTIGATE (a) — axiom-gate-join-coverage bijection failures

**Rail:** `axiom-gate-join-coverage`  
**Script:** `scripts/audit-axiom-gate-join-coverage.sh` + `scripts/audit-axiom-gate-join-coverage.ts`  
**Registry:** `.harness/axioms-v1.json`

**Actual failure captured (2026-06-10 run, exit code 1):**

The script exits 1 (bijection violations). Coverage assertion passes: all 9 axioms and all 21 gates were visited. The failure is entirely in Direction 1 (axiom → gate): 6 of 9 axioms are RED.

**Red axioms — specific ids and reason:**

All 6 carry `reason_code: UNPROJECTED_PAST_DATE`. Their `must_project_by` date was `2026-05-31`, which is 10 days past today (2026-06-10).

| ID | Tier | Status | must_project_by | Owner |
|----|------|--------|----------------|-------|
| V1 | value | PARTIAL | 2026-05-31 | Algol+Canopus |
| V2 | value | PARTIAL | 2026-05-31 | Algol |
| C1 | convention | UNPROJECTED | 2026-05-31 | Algol+Canopus |
| C4 | convention | PARTIAL | 2026-05-31 | Algol |
| C5 | convention | UNPROJECTED | 2026-05-31 | Algol |
| H1 | harness | UNPROJECTED | 2026-05-31 | Canopus |

**Root cause analysis:**

This is NOT a script bug. The audit logic is correct and intentional. These axioms were signed by Peat on 2026-05-30 with `must_project_by: 2026-05-31` — a one-day window. The `audit-axiom-gate-join-coverage.ts` logic at line 358 is explicit:

> "This axiom wears a signature but has no enforcing gate past its deadline. Articulated-but-unprojected-ought: most dangerous class."

The 6 axioms never had enforcing gates added within the window. The specific gap per axiom:

- **V1** (low-vision a11y): `projects_to: [gauntlet-min-legible-size]`. The gate exists and is enforcing, BUT V1's status remains `PARTIAL` because C1 (its convention-tier realization: WCAG 2.2 AA contrast) is UNPROJECTED. The gate `accessibility-floor` is a stub and does not satisfy the PARTIAL status.
- **V2** (visual fidelity): `projects_to: [gauntlet-sub-pixel-detection, gauntlet-overlap-composition]`. Both gates exist and are enforcing. V2 status is PARTIAL because the full pixel-anchor render-fidelity Playwright diff is unprojected.
- **C1** (WCAG 2.2 AA contrast): `projects_to: []` — empty. No gate. Status UNPROJECTED past deadline.
- **C4** (font-chain spec): `projects_to: [font-chain-presence]`. Gate exists and is enforcing. Status remains PARTIAL because the proxy-only nature of font-chain-presence is acknowledged; full Playwright render-fidelity gate is Wave B planned work.
- **C5** (motion buckets): `projects_to: []` — empty. No gate. Status UNPROJECTED past deadline.
- **H1** (gate green must trace to ground-truth): `projects_to: []` — empty. No gate. Status UNPROJECTED past deadline.

**Correct fix (Peat-at-seam — no blind edit made):**

The registry is Peat-signed. Every change to `.harness/axioms-v1.json` requires a new Peat signature. The correct remediation options per axiom are:

1. **C1, C5, H1** (no gate at all): either add an enforcing gate to harness config that realizes the axiom and update `projects_to`, OR update status to `BLOCKED` with a `block_until` date and `blocked_on` reason (buying formal time without falsifying).
2. **V1, V2, C4** (gates exist but status is PARTIAL past deadline): update status to reflect current reality — either `PROJECTED` if the partial coverage is deemed sufficient for now, or `BLOCKED` with justification.

This is an axiom-registry change (Peat-at-seam). No code or registry edit made here.

---

### INVESTIGATE (b) — search-index 14 ≠ 15

**Rail:** `audit-search-index-completeness`  
**Script:** `scripts/audit-search-index-completeness.sh`

**Mismatch confirmed as real (not a stale-build artifact):**

The build output is present at `.next/server/app/`. The script exits 3 (SKIP) only when that directory is absent. With the directory present, the script ran fully and reported:

```
pagefind page_count (from entry.json): 14
crawlable_count (from site dir):       15
```

This is a live 15-vs-14 mismatch on the current build, not a stale artifact.

**The +1 page (crawlable but not indexed): `.next/server/app/console.html`**

Enumerated crawlable pages (15 total, excluding `_global-error.html` and `_not-found.html`):

```
archive.html
articles/000.html, 001.html, 002.html, 003.html
console.html            ← this is the +1
fiction/transmission-001.html
index.html
photos/2026-04-chiang-mai.html
photos/2026-04-chiang-mai/DSCF0001.html
photos/2026-05-bangkok.html
photos/2026-05-bangkok/DSCF0002.html, DSCF0003.html, DSCF0004.html, DSCF0005.html
```

**Root cause — deliberate `noindex` directive, not a pagefind-body error:**

`console.html` contains in its `<head>`:

```html
<meta name="robots" content="noindex, nofollow"/>
```

Pagefind version 1.5.2 (confirmed from `pagefind-entry.json`) respects the `robots` meta tag and skips pages tagged `noindex`. This is correct crawler behavior — pagefind does not index pages that declare themselves off-limits to indexers.

`console.html` has zero `data-pagefind-body` occurrences — it has no indexable content marker. The `/console` route is an internal admin/authoring interface (the ATLAS console and node graph editor), not a content page. `noindex, nofollow` is intentional.

**Assertion 2 (hidden/RSC-only pagefind-body):** PASSES. No RSC-payload-only or display:none `data-pagefind-body` elements found anywhere.

**Why the rail fires FAIL (exit 1) on this:**

The rail's assertion 1 is a strict count equality: `page_count == crawlable_count`. It does not exclude `noindex` pages from the crawlable count. The count enumeration uses `find .next/server/app -name '*.html' ! -name '_global-error.html' ! -name '_not-found.html'` — this includes `console.html`. Pagefind excludes it → counts diverge.

**Recommended fix (no code edit made — owner decision required):**

Two options for the rail owner (Algol):

**Option A — Exclude `noindex` pages from the crawlable count.** Add a filter to the `find` enumeration that also excludes HTML files containing `<meta name="robots" content="noindex`. This makes the count semantically correct: "pages that pagefind would index" rather than "all HTML files". Implementation: parse each HTML file's robots meta before counting, or maintain an explicit exclusion list at `.harness/pagefind-noindex-exclusions.txt`.

**Option B — Add `console.html` to an explicit exclusion list.** Simpler and more auditable: add `console` to a harness-level exclusion list that the count query subtracts. Requires a one-line config change at `.harness/` level (not Peat-signed seam).

The root cause is NOT a pagefind configuration error or a content-layer bug. The `/console` route is correctly marked `noindex`. The rail's count comparison is too broad — it counts all crawlable HTML including intentional noindex pages. The fix is a one-liner in the audit script or an exclusion config, but it is an Algol-owned change to the rail logic.

No code or registry edit made. Recommending Option A as the cleaner long-term approach (self-documenting via the exclusion filter). Either option requires no Peat-at-seam approval — both are rail-logic changes within Algol's territory.

---

*End of report.*
