# WITNESS-REF-DESIGN.md — the forge-resistant trust-root for the GENESIS integrity ledger

> Owner · Canopus (α-HRN-07)
> Task · TASK-2026-06-04-INTEGRITY-FORGE-ROOT
> Status · BUILT & INERT. Nothing here is live. Peat wires at the seam (§4).
> Closes · M1-B (ledger co-tamper) AND M2-C5 (deletion-co-tamper) — one shared root.
> Companions · `scripts/audit-ledger-append-only.sh` (the assertion),
>   `.github/workflows/ci.yml` (the witness substrate),
>   `.claude/hooks/integrity-write-ledger.sh` (the producer).

---

## 0 · The one-sentence claim

The integrity ledger is trustworthy **not** because any value inside it is signed,
but because its **committed history is append-only**, and that append-only property
is **witnessed by CI running on a substrate the writing agent cannot fake**, over a
**ref the agent cannot rewrite** — the rewrite being prevented by a branch-protection
toggle **only Peat can set**.

Everything below is the precise mechanism behind that sentence.

---

## 1 · Why no LOCAL anchor is forge-resistant (the irreducible root, made concrete)

The integrity-ledger producer (`integrity-write-ledger.sh`) runs inside the agent
session. The agent runs **as Peat**: it holds filesystem **write AND read**. Walk the
candidate local anchors and watch each one fall:

| Candidate local anchor | Why the fs-write+read agent forges past it |
|---|---|
| A Canopus-held signing key over the ledger | The key sits on the same filesystem the agent reads. Agent reads key → re-signs the forged ledger. |
| OS permission lock (chmod 0444, root-owned) | The agent IS the owner/custodian of these paths. Owner can chmod and rewrite. |
| In-file hash chain (`prev_hash` per line) | The agent recomputes the whole chain over the mutated text. Round-1 refutation B2 proved this empirically. Also fails on the **terminal** entry (B1): a chain protects line N only via line N+1, and a handoff's ledger line is always last for its path, so it has no successor to protect it. |
| sha256-recompute audit (local or remote) | A co-tamper rewrites the body **and** the stored `sha256` to match. Every recompute passes by construction. This is the core trap; see §2. |

The common failure: **anything the agent can read, it can forge; anything it owns, it
can rewrite.** Forge-resistance must come from outside the agent's reach. There are
exactly three such components, and all three are required:

- **(a) the witness substrate** — CI on GitHub's runners. The agent cannot make
  GitHub's runner emit a green it did not earn; it does not control that machine.
- **(b) append-only git history** — the agent cannot change a *prior committed*
  ledger line without **rewriting history** (amending/rebasing the commit that
  introduced it).
- **(c) the no-force-push toggle** — rewriting history and publishing it requires a
  **force-push** to the witness ref. **Branch protection (no-force-push) on the
  witness ref prevents that.** That toggle is set **only by Peat**, once, at GitHub
  (§4). It is the single human-at-seam precondition the whole root rests on.

Remove any one of (a)(b)(c) and the root is forgeable. With all three, the agent's
only move to hide a co-tamper — rewrite history on the witness ref — is exactly the
move (c) forbids.

---

## 2 · Why this is NOT a hash-recompute (the trap the round-1 refutation set)

A naïve integrity check recomputes `sha256sum <file>` and compares it to the ledger's
stored `sha256`. **This always passes a co-tamper**, because the M1-B / M2-C5 attacker
edits the body *and* rewrites the stored hash so the two still match. A recompute —
local or in CI, it does not matter where — is blind to this.

The only property that catches it is historical, not computational:

> **"this ledger entry was a DIFFERENT value (or was PRESENT) in prior committed
> history."**

`audit-ledger-append-only.sh` asserts exactly that. It never recomputes a body hash.
It walks the **committed revisions** of the ledger oldest→newest and checks that each
revision's content has the previous revision's content as an exact **line-prefix**
(revision N == revision N-1 + zero-or-more appended lines):

- a **co-tampered** line (M1-B) — its bytes changed → prefix breaks → VIOLATION
  (this catches the **terminal** entry, which the in-file chain provably cannot);
- a **deleted** line (M2-C5) — it vanished, shifting the content → prefix breaks →
  VIOLATION.

The integrity claim is anchored in git history, not in any value the current working
tree can present. That is the whole difference.

---

## 3 · The witness ref — a dedicated FAST-FORWARD-ONLY branch

### 3.1 Why a dedicated ref (not Peat's working branch)

Peat's working branches stay **rebaseable** — he amends, squashes, and force-updates
them freely; that is normal solo workflow and must not be taken away. But the
append-only witness needs a ref whose history is **never rewritten**. Reconciling
these: the ledger's witnessed history lives on its **own** ref, separate from any
branch Peat rebases.

```
  witness ref:   refs/heads/integrity-witness     (fast-forward only, protected)
                 └── only ever GAINS commits; never amended, never force-pushed
  working refs:  genesis/*, main, …               (rebaseable as usual)
```

The witness ref is **append-only by policy + branch-protection**, mirroring at the
git layer the append-only property the ledger has at the file layer. The two reinforce:
the file is append-only *within* a commit's blob; the ref is append-only *across*
commits.

### 3.1a Merge context — why the walk is `--first-parent`, and which CI run is load-bearing

The audit walks `git rev-list --reverse --first-parent <ref>` — it follows the
witness ref's **own spine**, not interleaved side-branch revisions. This matters the
moment the ledger is seeded and committed at task boundaries on rebaseable working
branches (which this design wants): two branches each append a *different* ledger line,
then merge. The merged blob is `header + a + c + b`. A naïve all-revisions walk would
see side revisions `…,a,c` and `…,a,b` and **false-positive VIOLATION on a legitimate
merge** — a rail spewing reds in normal operation, which violates the Harness quality
bar in its own right. Along the **first-parent spine**, every step is a pure append
(`…,a` → `…,a,c` → `…,a,c,b`), so a legit merge PASSes; a real co-tamper committed
*onto* the spine still breaks the prefix and VIOLATEs. (Both verified in sandbox:
legit-merge-keeps-both → PASS; co-tamper-on-spine → VIOLATION.)

Because forge-resistance attaches only to the **protected witness ref**, the CI step is
split:

| CI run | `if:` condition | Status |
|---|---|---|
| **authoritative** | `github.ref == 'refs/heads/integrity-witness'` | The load-bearing run. Peat should make THIS the required status check (§4 step 3). |
| **informational** | every other push/PR ref | Same `--first-parent` check, but these refs are rebaseable — a green is a convenience signal, not the anchor. Catches accidental non-append edits early. |

This split is a deliberate design choice (not a silent assumption that CI only sees
linear history). If a future need arises to harden the informational runs into anchors,
that is a Polaris-routed follow-on, not a property claimed today.

### 3.2 How the ledger reaches the witness ref

1. The producer hook (`integrity-write-ledger.sh`) appends lines to the working-tree
   ledger as writes happen. (Detective lag begins here: an uncommitted edit is not yet
   witnessed.)
2. At a task/session boundary, the ledger is **committed** (this is the existing
   "commit at boundary" discipline — see MEMORY commit-at-boundary feedback). A commit
   on a working branch is enough for the **local** copy of the audit to run, but the
   **forge-resistant** guarantee only attaches once the commit is **published to the
   witness ref**.
3. Peat (or a Peat-gated automation he explicitly authorizes — never an agent
   silently) **fast-forward-pushes** the ledger-bearing commits to the witness ref.
   Because the ref is fast-forward-only, this can only ever *extend* its history.
4. CI fires on that push (`on: push`), checks out the witness commit with **full
   history** (`fetch-depth: 0`), and runs `audit-ledger-append-only.sh`. Green = the
   newly-published history is still append-only relative to everything before it.

The ledger does **not** need to live only on the witness ref — it is the same file in
the normal tree. The witness ref is simply the **immutable publication channel** whose
history CI trusts. A co-tamper would have to be published to *that* ref to take effect,
and publishing a *rewrite* of it requires a force-push (forbidden).

### 3.3 Rotation / re-seed (the one non-append operation, and how to do it safely)

If the ledger is ever legitimately rotated (archived + started fresh) or re-seeded,
that is **by definition** a non-append-only change to the file's history and the audit
**will** flag it — correctly. Rotation is therefore a **deliberate, Peat-gated** event,
not an agent operation:

- archive the old ledger under a dated name (e.g. `integrity-ledger.2026-06-04.jsonl`),
  committed as a normal add;
- the producer writes a fresh ledger with a new one-time header line (see §5);
- Peat publishes the rotation commit to the witness ref and, if the witness baseline
  must reset, records the rotation in this doc and re-establishes the baseline commit.

Until a rotation is explicitly performed and documented this way, **any** shrink or
in-place change of a previously-committed ledger line is a VIOLATION.

---

## 4 · EXACT human-at-seam steps (only Peat does these)

These are the **only** actions that activate the root. No agent performs any of them;
agents leave the build inert in the working tree. Steps are ordered.

1. **Apply the report §2 wiring diff** (the existing settings.json PostToolUse +
   PreToolUse + rail wiring for M1–M4, gathered in
   `docs/qa/REPORTS/TASK-2026-06-04-MEMORY-POISONING-A.md` §2). This is unchanged by
   this task and remains Peat-only.

2. **Create the witness ref** from the current default branch tip:
   ```
   git branch integrity-witness
   git push origin integrity-witness
   ```

3. **Enable branch protection on `integrity-witness`** at GitHub
   (Settings → Branches → add rule for `integrity-witness`):
   - **Require linear history** / **block force pushes** — this is the load-bearing
     toggle. Without it, (c) is absent and the entire root is forgeable.
   - **Block deletions.**
   - Require the `ci` workflow's witness job to pass before any update (optional but
     recommended — makes the green a merge precondition, not just a report).
   - No required signatures, no secrets — consistent with the CI HARD CONSTRAINTS
     (no commit-signing, no Peat-key gating of agent autonomy).

   > THIS STEP IS THE PRECONDITION NAMED THROUGHOUT. The audit, the CI step, and the
   > producer are all inert decoration until block-force-push is ON for the witness
   > ref. It is the one thing only Peat can set, and the one thing the agent cannot.

4. **Seed the ledger** (the existing baseline-seed-pass, a separate writer task run
   after the §1/§2a hooks are wired) so every existing GENESIS node gets a ledger
   entry, then **commit and fast-forward-push** the seeded ledger to the witness ref.
   The append-only audit goes NEUTRAL→PASS the moment there are ≥2 committed revisions.

5. **Establish the publication cadence**: at each task/session boundary, fast-forward
   the witness ref with the new ledger commits (Peat, or a Peat-authorized push step —
   never a silent agent push).

After step 3, and once seeded (step 4), the root is live and **detective**.

---

## 5 · The producer change (what made the ledger a committable append-only artifact)

`integrity-write-ledger.sh` gained ONE minimal, inert addition: `ensure_ledger_header`
writes a single sentinel line the first time the ledger is created:

```json
{"_ledger":"integrity-append-only","schema":1,"anchor":"committed-git-history+CI-witness","not_a_chain":true,"forge_root_doc":".harness/WITNESS-REF-DESIGN.md","created_at":"…"}
```

Design constraints honored:

- **No forgeable in-file chain.** The round-1 refutation demanded a *producer* (it had
  a verifier-without-producer). It did **not** ask for an in-file hash chain — and a
  chain would be forgeable here (§1). The header carries **no secret, no hash, nothing
  the agent could usefully forge** — only a self-describing pointer to where the real
  anchor lives (this doc). `"not_a_chain":true` says so explicitly.
- **Written exactly once**, on creation, never rewritten → it is the immutable line-0
  baseline the append-only witness checks every later commit against.
- **Inert to existing readers.** It has no `"path"` field. `audit-handoff-integrity.sh`
  filters on `.path | test("\.claude/handoffs/")` and `audit-memory-drift.sh`
  enumerates disk nodes / ledger `path` keys — both skip a line with no `path`. Verified
  empirically: header present → M1 no PARSE_FAILURE / no CHAIN_BROKEN; M2 does not
  enumerate it as a node.
- The producer remains an **observer** (always exit 0). The header write is wrapped in
  the same swallow-on-error pattern as every other ledger op.

---

## 6 · DETECTIVE vs PREVENTIVE — stated plainly

This root is **DETECTIVE**, and its detection is **lagged**:

| Property | This root (CI witness over committed history) |
|---|---|
| **Class** | Detective. It does not *block* a co-tamper at write time; it *reveals* one after the fact. |
| **Lag** | Bounded by the publish cadence: a tamper is caught at the **next push + CI run** of the witness ref (§3.2 step 4). Between an in-place edit and the next witnessed push, the tamper is present-but-not-yet-detected. This is the cost of forge-resistance: the only un-forgeable substrate is the remote one, and reaching it takes a push. |
| **What it catches** | Any mutation or removal of a **previously-committed** ledger line — M1-B (incl. terminal entry) and M2-C5. With certainty, once published. |
| **What it does NOT do** | It does not prevent the edit, and it does not witness uncommitted working-tree state. |

What a **read-time hook** would add (PREVENTIVE, and explicitly NOT built here):

- A `PreToolUse`/read-time guard could compare the ledger's working-tree tip against
  the **last witnessed commit** on every read/handoff and **block** if the working tree
  has diverged from witnessed history in a non-append way — closing the detective lag
  for the *local* session.
- **But** such a hook is itself local, and runs as the same fs-write+read agent, so it
  is **forgeable in isolation** (the agent can edit the hook, or the cached
  last-witnessed value). It only adds real preventive value **layered on top of** this
  detective root — it borrows its trust from the witness, it cannot replace it.
- Recommendation: ship the detective root first (it is the irreducible one). A
  preventive read-time companion is a **follow-on HARDEN**, valuable only once the
  witness ref + branch protection (§4 step 3) are live to anchor it. Routing that
  follow-on is Polaris's call; it is out of scope for this slice.

---

## 7 · Inert-state confirmation

- `scripts/audit-ledger-append-only.sh` — read-only; no tracked-file mutation; no
  network. On the real repo today (ledger absent from history) → **exit 0 NEUTRAL**.
- `.github/workflows/ci.yml` — additive witness step after `node --test`; read-only
  token; no secrets; no signing. NEUTRAL until the ledger is seeded and the witness ref
  is published+protected.
- `.claude/hooks/integrity-write-ledger.sh` — header addition is observer-only (exit 0),
  written once, inert to M1/M2 readers.
- **No** `settings.json`, **no** `.claude/beta/**`, **no** hooks-registration touched
  by this slice. **No** commit, push, or ref created by the agent. Peat wires at §4.
```
