# Free observability QA

Date: 2026-09-08. Agent: Algol · α-VER-06.
Task: TASK-2026-09-08-FREE-OBSERVABILITY.
Baseline: `41a73a8af9da6dc9246513d70f46178059bd4d21`.
Worktree: `/private/tmp/personal-website-observability.CiDfPw`.

## Candidate verdict

Focused regression PASS: **258/258**, including 82 new observability cases and
176 existing media, OAuth and security cases. Release acceptance is still
pending exact integrated/remote gates, production deployment, live five-check
results and the first actual GitHub monitor run. This candidate report does not
claim that the schedule is active or that notification delivery was tested.
Final release receipts belong in the task handoff, without rewriting signed
candidate evidence solely to advance a deployment SHA.

Algol made no production requests, fault injection, account/browser operations,
credential reads, database/storage changes or heavy builds. Only synthetic SDK,
HTTP and process fixtures were used. Parent and Canopus own live observations,
plan checks, deployment and shared gates. The original dirty checkout and
previously signed media-privacy artifacts are untouched.

## Behavioral evidence

`tests/photo-media-observability.test.mjs` — **33/33 PASS**. It executes the
actual media helper, owner guard and verified-Google identity predicate, mocking
only external Supabase clients and the logging boundary. It verifies:

- Exactly one JSON string containing only the fixed `photo_media_failure`
  event, stage and category for unexpected failures. No error-derived field,
  key, token, body, stack or identity enters the log.
- Returned entry/asset/storage errors, exceptions at all five stages, missing
  public configuration, empty download and hostile classification getters.
- Logger exceptions cannot change the response or recursively create logs.
- Known denied/not-found Storage shapes stay silent, including the SDK's legacy
  HTTP400/statusCode404 shape. Unknown operational codes such as `NoSuchBucket`
  remain observable even with HTTP404.
- Success for a guest and a verified-owner draft preview stays silent. Normal
  absence, malformed input, unpublished rows and variant mismatch stay silent.
- Every tested failure preserves the exact generic 404 and browser/CDN no-store
  headers with Cookie variation. Real owner sessions are not used.

Altair owns the implementation, not Algol. Reviewed `lib/server/photo-media.ts`
SHA256: `3c7c42ac005384483cd74fb442fc2813c782a34418af263843f5ce850a2a119c`.
Altair independently reports its 33 new plus 61 prior media tests PASS and
owned-file ESLint PASS; Algol's combined execution below is separate evidence.

`tests/production-monitor.test.mjs` — **44/44 PASS**. It executes the real
dependency-free runner with synthetic fetch responses, including its real CLI
in child processes with network replaced before import. It verifies:

- Exactly five credential-free sequential GETs, no redirect following/retries,
  fixed check labels and paired checked/public-Storage URLs for the same key.
  The synthetic absent key has a valid route format, not malformed-input syntax.
- Complete public HTML markers; correct WebP MIME, RIFF length and exact hash;
  recognized JSON denial envelopes; checked-media private/no-store and Cookie
  variation. Image-shaped bytes are synthetic transport fixtures, not a visual
  assessment of a real photograph.
- Unexpected public image success, synthetic/auth success, all five redirects
  and HTTP500 responses fail instead of being counted as privacy passes.
- Wrong MIME/magic/hash, login-only or incomplete HTML, empty bodies, malformed
  JSON, unknown Storage errors and inconsistent authorization envelopes fail.
- Header and streaming body limits, actual-byte overflow despite a false small
  Content-Length, truncation and stream errors. Cancellation cannot hang the
  runner; deadlines cover both unresolved headers and unresolved body reads.
- Token-bearing exceptions and hostile getters/serialization cannot escape in
  report fields. Public output is limited to labels, booleans, numeric status
  and timing, and fixed reason enums.
- Invalid option limits fail before requests. Import performs no network or
  console output. The real CLI reports sanitized JSON and exits 1 on mocked
  failures; this is not a production incident or email-delivery test.

`tests/production-monitor-workflow.test.mjs` — **5/5 PASS**. Parsed workflow
checks evaluate the job guard for 16 public/private, fork/non-fork, repository
and branch combinations before runner allocation. They require hourly minute17
plus manual triggers, canonical public default branch, standard Ubuntu, at most
two minutes, read-only permissions, immutable trusted action pins, disabled
checkout credentials and disabled automatic package-manager caching. No install,
build, artifact, cache, secret or deployment operation is introduced.

The actual `node ... | tee` command is executed under GitHub's explicit bash
`-e -o pipefail` semantics with a failing synthetic node function: **exit 1** is
preserved. The dangling Vercel cron is absent from configuration. The independent
weekly rebuild workflow remains byte-identical, SHA256
`3205ab453acfc3fcec0912b4d5148d14f5cd72ffcb9ca4f160624acd25fc9920`.

All three new suites are registered as required in
`tests/harness/ci-test-census.json`; complete tracked-discovery census execution
is a separate coordinated CI gate.

## Test-first trail and retained receipts

The TDD skill shaped small implementation handoffs through the public interface:

1. `eb2fe3`: entry-error response was already generic/no-store, but expected log
   count 1 was actually 0. Runner/workflow initially failed on missing files;
   those were explicitly scaffold REDs, not executed monitoring behavior.
2. `834195`: returned asset/storage errors were still silent; entry tracer green.
3. `cee9b1`: 11 normal Storage denial shapes incorrectly logged. The classifier
   repair made them silent while preserving operational-error visibility.
4. `7ab6e0`: eight thrown/configuration/empty-download cases lacked fixed events.
   The stage-aware catch and empty-download branch made them green.
5. `b57c73`: the synthetic sentinel initially used invalid route syntax. Canopus
   corrected it to a valid, clearly absent key; 43 other runner cases passed.

Additional cases were added against implemented behavior; not every passing
case is represented as having had an individual prior RED. One workflow fixture
initially lacked GitHub's `format` helper; that fixture was corrected for the
valid default-branch guard, not reported as an application bug.

- Own fresh pre-task: PASS, preserving two pre-existing tracked changes.
- `eda570`: new suites **82/82 PASS**, targeted test ESLint and diff check clean.
- `6afd4e`: combined **258/258 PASS**, exit 0, zero skips/cancellations/failures:
  61 media privacy + 3 operation-policy + 79 OAuth + 33 security + 82 new tests.
- No new focused regression remains. Shared lint/typecheck/build, full CI rails
  and release receipts remain pending here; do not infer that every optional
  harness rail passes from these focused results.

Clean-code review: **8/10** for this test slice. Production interfaces and narrow
external fixtures keep behavior readable and deterministic. A future shared TS
fixture loader could remove duplication with older suites; that refactor is
outside this bounded monitoring change and is not required for acceptance.

## Acceptance and coverage limits

| Criterion | Candidate evidence / remaining release evidence |
| --- | --- |
| AC1: redacted failure logs and unchanged private responses | 33 behavioral cases and prior media/OAuth/security regressions PASS; no production failure injection. |
| AC2: five checks and failure modes | 44 deterministic cases PASS; actual five live check results still required. |
| AC3: active schedule and failure alerting | Guard/pipeline/CLI behavior PASS; main workflow activation and first actual GitHub run still required. Email delivery is untested and not guaranteed. |
| AC4: free-tier/cost bounds | Workflow constraints PASS. Runbook documents 744 scheduled runs / 3,720 GETs per 31-day month, about 13.7 MB normal thumbnail bytes and 838 MB summed consumer body ceilings, plus manual runs/overhead. Root owns observed account-plan evidence. |
| AC5: cron cleanup without rebuild changes | Config and weekly byte hash PASS; deployed cron removal still requires the new production deployment. |
| AC6: release gates and guest smoke | Focused 258 PASS; coordinated full gates, exact CI/READY/deployment, live checks and bounded error scan pending in release handoff. |

The paired public-photo success/public-Storage denial detects an accidentally
public bucket without placing real draft names in public automation. Synthetic
absence **does not prove arbitrary real-draft RLS denial**. It is not an owner
session test, complete image matrix, originals audit, browser check or universal
error tracker. Existing manual privacy evidence is not relabeled as this task's
new live proof. An owner intentionally replacing/unpublishing the pinned public
photo should trigger a failure and a reviewed pin change, not weakened checks.

GitHub schedules are best-effort and may delay/drop runs or disable after 60 days
of inactivity. A missing/skipped monitor is not healthy. Notification settings
and recipient behavior are user-controlled; the runbook describes limitations
and periodic freshness checks. No native notification setting is modified by
Algol. The monitor consumes existing free allowances: no added paid service is
not the same as zero resource use. Stream caps bound consumption by the reader,
not already-arrived transport chunks or upstream work.

Baseline operational gaps addressed are silent media failures, no recurring
public/private-bucket sentinel and the dangling Vercel cron. Historical logging
outside this helper, Pagefind lifecycle concerns, unrelated advisory notices and
any pre-existing optional harness failures are outside scope. Preserve the
current authorization/RLS policies and private photos bucket during recovery;
never reopen Storage to restore availability.

## Addendum: live denial-envelope correction

Task: `TASK-2026-09-08-FREE-OBSERVABILITY-DENIAL`, baseline `65b6a87`.
The candidate evidence above is preserved as written. Initial live GitHub run
`34157834725` failed `legacy_storage_denied` with `invalid_body`; it is not
retroactively a passing run. Root's bounded receipt `1db7f1` identified HTTP400
JSON with statusCode `404`, code `NoSuchBucket`, and both error/message exactly
`Bucket not found`. Root reports that checked drafts and old public URLs still
denied image delivery: this was a monitor false negative, not observed exposure.

The [Storage error documentation](https://supabase.com/docs/guides/storage/debugging/error-codes)
explains that a missing-bucket code can also indicate inaccessible Storage.
The repair accepts only the complete observed shape alongside the existing
`not_found` shape. The coupled published-photo control remains mandatory;
generic HTTP400/404, outages, redirects and unexpected image success still fail.

Algol's new fixture reproduced the mismatch before repair (`5abb43`, exit 1).
Ten added cases cover the observed envelope, eight near misses and a failed
published-image control despite an accepted denial. After Canopus's repair,
runner **54/54** and all affected observability suites **92/92 PASS** (`51d693`,
exit 0); targeted test ESLint PASS (`5c3016`). No application/auth/Storage policy
was changed, no new real draft metadata entered tests, and Algol made no live
request or build. New CI, successful actual GitHub run and final release
acceptance remain pending this addendum; retain the initial failure and original
signatures as historical evidence against their original candidate.
