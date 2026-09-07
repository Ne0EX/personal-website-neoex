# Free production observability

Owner: Canopus · TASK-2026-09-08-FREE-OBSERVABILITY.

The monitor checks public behavior without credentials, private draft names,
owner sessions, or an external monitoring service. Media failures use the
existing Vercel runtime logs; this is not comprehensive error tracking or an
uptime SLA. No plan upgrade, paid drain, new credential or SDK is required.

## Checks and privacy boundary

`node scripts/production-monitor.mjs` runs exactly five sequential GETs, with
no retries, redirect following, cookies, Authorization headers or target inputs.
Importing the module does not make requests. The exported `runMonitor` accepts
an injected fetch, a shorter timeout and a test hash; the CLI always uses fixed
production targets and its pinned public-thumbnail SHA256.

| Check label | Required result | Body cap |
| --- | --- | --- |
| `public_page` | `/en` returns 200 HTML with the Worldline title, public `paper-canvas` main and complete document | 1 MiB |
| `published_photo` | Known published thumbnail returns 200 WebP, correct RIFF size and pinned SHA256, private/no-store and Vary Cookie | 64 KiB |
| `legacy_storage_denied` | The same public photo key through its historical public Storage endpoint returns 400/404 JSON with statusCode 404 and an explicitly recognized denial envelope (below) | 4 KiB |
| `synthetic_photo_denied` | Clearly synthetic absent checked-media key returns 404 JSON `NOT_FOUND`, private/no-store and Vary Cookie | 4 KiB |
| `guest_auth_denied` | Anonymous auth probe returns 401 JSON `ok:false`, error `AUTH` | 4 KiB |

The thumbnail is already deliberately public. Its blocked historical Storage
URL provides a credential-free sentinel for the bucket becoming public. The
synthetic missing key does **not** prove that every real draft remains denied;
this does not replace the media/RLS regression suites or a scoped guest audit.
It does not test owner login, authenticated RLS, originals, every image format,
browser rendering or JavaScript errors. A green public page alone is not proof
that its database-backed content is complete; the image is the dependency check.

Recognized Storage envelopes require statusCode `404` (number or string) plus
either error `not_found`, or code `NoSuchBucket` with both error and message
exactly `Bucket not found`. No generic 400/404 or arbitrary JSON error passes.
The first real run, 34157834725, failed because the original validation was too
narrow when Storage returned the second envelope. The denial-format correction preserves
that failed run and accepts only this observed inaccessible-bucket response;
the successful paired checked thumbnail must still prove published delivery.

The pin identifies the public thumbnail verified during setup: 18,462 bytes,
SHA256 `de84121272b728cf00f3e00dba62524c46584daaae331c67d57a4dc34f499b5f`.
If the owner unpublishes or replaces that photo, failure is intentional: review
and select a different deliberately public thumbnail, updating both paired
targets and the pin together with tests. Do not disable the privacy check or
substitute an arbitrary nonexistent Storage key to make the monitor green.

Every response is streamed with a ten-second deadline covering headers and body.
Actual bytes, not only Content-Length, are capped. A hung transport or cancellation
cannot block the runner indefinitely. The script buffers at most one capped body
at a time and cancels oversized responses; network chunks already delivered and
upstream processing may exceed the consumer cap. HEAD is not a bandwidth shortcut:
the current media HEAD handler internally performs GET, and Range is not supported.

Public output contains only check labels, numeric HTTP status/timing, booleans and
fixed diagnostic categories. Response bodies, URLs, keys, raw error objects,
headers, hashes, cookies, tokens and environment values are never printed or
uploaded. Transport failures, unexpected redirects, HTML login fallbacks,
malformed or oversized responses are monitor failures, not privacy passes.

## Scheduling, cost and alerts

`.github/workflows/production-monitor.yml` runs hourly at minute 17 UTC and supports
manual dispatch. Only the canonical public, non-fork repository's default branch
can allocate a standard `ubuntu-latest` runner. Changing visibility to private
skips the whole job; **skipped is not healthy**. Do not remove this guard without
reassessing the no-added-cost requirement.

The job has a two-minute hard limit, read-only contents permission, immutable
official action pins and checkout credential persistence disabled. It performs
no package installation, application build, deployment, cache write or artifact
upload. Node setup's implicit package-manager caching is disabled. The sanitized
JSON goes to the run log and job summary; failure marks the job red with a fixed
annotation. There is no webhook, external email service or issue-writing token.

At the configured cadence, a 31-day month schedules at most 744 runs and 3,720
application/Storage GETs: 2,976 site requests plus 744 Storage requests. The normal
thumbnail payload totals 13,735,728 bytes (about 13.7 MB). All five consumer body
caps total 1,126,400 bytes/run, or 838,041,600 bytes (about 838 MB) over 744 runs,
excluding headers, transport overhead, runner setup, manual runs and upstream
processing. Each manual dispatch adds one bounded run. These requests still
consume existing Vercel/Supabase free allowances; tiny traffic is not zero usage.

GitHub currently makes standard hosted runner use in public repositories free;
larger runners and private-repository overages are different products. See
[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
The repository was confirmed public and the existing Vercel Hobby/Supabase Free
plans were observed during this task; the workflow does not change those plans.

The account's existing Actions notification setting was observed as **Email,
failed workflows only** on 2026-09-08; it was not changed. GitHub sends scheduled
workflow notifications to the creator/last cron editor or re-enabling actor.
Manual-run notifications follow the triggering user's settings. This is an
existing opt-in, not verified email delivery or guaranteed incident paging. See
[workflow notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
and [notification settings](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-github-actions-notifications).

GitHub schedules are best-effort: high load may delay or drop queued runs, and
public-repository schedules disable after 60 days of inactivity. A stale or
disabled monitor cannot notify about its own absence. Check the Actions page
after deployment and periodically (at least monthly) for recent successful runs;
re-enable a disabled schedule when appropriate. No keep-alive commits are created.
See [scheduled events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Failure triage and recovery

1. Inspect the fixed failed check/reason and latest deployment identity. Do not
   paste response bodies or private URLs into a public issue or Actions log.
2. Use a single manual dispatch to confirm a transient failure; there are no
   automatic retry storms. A skipped run or missing recent run is a monitoring gap.
3. For published-photo failure, inspect redacted `photo_media_failure` events in
   Vercel runtime logs. Expected denials and successful requests stay quiet;
   a storage not-found/denied response may be an unpublish race and stay quiet too.
   Empty error logs are not independent proof that delivery works.
4. For a legacy-Storage unexpected success, investigate the bucket privacy state
   immediately through approved tools. Never publish the bucket to restore image
   delivery. Preserve the exact published-variant and operation-scoped RLS policy.
5. If this monitor itself regresses, disable this workflow or fix forward/revert
   only its changes. Do not revert the earlier privacy repair or make `photos`
   public. Request/response redaction must remain intact.

`vercel.json` now declares an empty cron list, removing the nonexistent
`/api/cron/weekly-rebuild` endpoint on the next production deployment. Vercel
requires redeployment to apply cron removal; see
[cron maintenance](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
The separate GitHub weekly deploy-hook workflow is unchanged and is not a health
monitor. This runbook does not claim a live schedule, cron removal or successful
deployment until the release receipt records those checks.

## Verification

Algol's deterministic tests cover the real runner with injected public fixtures,
no production fault injection, plus the workflow's billing/privacy constraints.
Run the registered suites through normal required CI and the coordinated
lint/typecheck/build gate. Release acceptance also requires one actual GitHub
monitor run and all five live checks, with exact deployment/CI receipts retained
in the task handoff. Failure fixtures prove nonzero exit, not email delivery.
