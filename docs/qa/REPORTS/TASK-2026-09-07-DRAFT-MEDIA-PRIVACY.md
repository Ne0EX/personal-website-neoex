# Draft media privacy QA

Date: 2026-09-07. Agent: Algol · α-VER-06.
Task: TASK-2026-09-07-DRAFT-MEDIA-PRIVACY.
Source baseline: `b4717fbd3a13d723da01d788bf977c02bd40d7ee` in
`/private/tmp/personal-website-console-google-oauth`.

## Current verdict

Focused regression PASS; release acceptance remains pending live enforcement,
integrated gates and exact deployment evidence. This report does not claim that
the former public URLs have already stopped serving images. Preserve the
original dirty checkout, all photographs and the parent's existing status edit.

Algol performed no live content/storage writes, account operations, credential
reads, browser authentication or paid model calls. Test fixtures contain only
synthetic records and image bytes. Other agents' live observations are explicitly
attributed below and are not represented as Algol's own guest requests.

## Behavioral coverage

`tests/draft-media-privacy.test.mjs` executes the actual production URL helper,
media helper, GET/HEAD route, authorization predicate, owner guard and store
mappers. Only external Supabase boundaries are replaced with controlled clients.
Unexpected network requests fail the test. The authorization guard and Google
identity predicate are not replaced with unconditional test approvals.

The 61 passing cases cover:

- Stable same-origin variant URLs without signed tokens; optimizer configuration
  disabled so the unused image optimizer cannot provide a separate cached path.
- Published guest image bytes and verified-owner draft preview; rejected Google
  account, unverified identity, password-only owner, editable-metadata spoofing,
  missing membership and truthy non-boolean membership. Rejected identities use
  a fresh anonymous client for every data/storage read, even for public photos.
- Fifteen malformed key cases, including traversal, encoded traversal, embedded
  separators, originals, external URLs, unsupported type/size and invalid hashes.
  Rejection happens before database or storage access, including for the owner.
- Exact registered-key membership; missing entries/assets, orphan or unmapped
  objects, null registries, different keys and a key stored in the wrong slot.
- Database/Storage errors and exceptions, plus an explicit denial when a draft
  is returned despite the published filter. Only the generic 404 envelope is
  exposed; no internal failure text is reflected.
- All nine size/format combinations with exact MIME and fixture-byte equality.
  The synthetic bytes prove transport preservation, not real image decoding.
- GET and HEAD for public guests, draft guests and draft owners. Hostile token
  query parameters, Range and conditional headers do not bypass checks or return
  stale 304 data. HEAD has no body; no write methods are exported.
- Browser/CDN no-store, Cookie variation, nosniff and absence of redirects on
  allow/deny paths; upstream anonymous fetch and owner Storage download no-store.
- A second request for the same stable key after a simulated publish-to-draft
  transition is denied. A simulated Storage denial after the application lookup
  is also denied; actual concurrent SQL enforcement is a separate live concern.
- Byte-exact authored bodies through all four shared mappers, including legacy
  URL literals in prose, Markdown, HTML, code fences and query values; article
  patch notes remain unchanged.

Two cases inspect the migration source: exactly nine registered variant slots,
photo/published constraints, download-only operation restriction, and no changes
to originals or existing write policies. These are SQL contract checks, not an
executed RLS simulation or proof of effective combined live policies.

The suite is registered as required in `tests/harness/ci-test-census.json`.

## Test-first evidence and review corrections

Observed failing tests before the relevant fixes:

1. URL helper returned the old public Storage URL instead of the checked route.
2. Optimizer configuration was unset instead of disabled.
3. Draft reader interface was initially absent. This was an interface/scaffold
   RED, not a test reproducing the live public-bucket bypass.
4. Migration lacked the download-only operation restriction. Root and Canopus
   identified that a broad SELECT policy could also mint durable signed URLs.
5. Owner download omitted the explicit upstream no-store fetch option.
6. Four shared mappers rewrote authored body bytes, including code and prose.

All six corrections are now covered by passing regressions. Additional negative
and route cases were added against the implemented interface; not every case is
claimed to have had its own prior failing run.

Algol independently traced shared mappers into console admin reads and raised
the editor round-trip risk. Root's live aggregate-only checks found zero existing
entry or roll bodies containing legacy public photo URLs or image JSX. The
approved narrower fix therefore removes text-wide normalization entirely rather
than rewriting authored documents. Future picker URLs use the checked helper.

## Verification evidence

- Initial OAuth baseline: 79/79 PASS before this implementation.
- Final focused command:
  `node --test tests/draft-media-privacy.test.mjs tests/console-google-oauth.test.mjs tests/security-netra-contracts.test.mjs`
  — 173/173 PASS, zero failures/skips (61 media, 79 OAuth, 33 security contracts).
- `npx --no-install eslint tests/draft-media-privacy.test.mjs` — PASS.
- `git diff --check` — PASS.
- Algol pre-task hook — PASS, preserving the pre-existing dirty baseline.
- Cross-impact review covers shared variant URL consumers, console raw-body
  reads, the GET/HEAD adapter, private download selection and ingestion cache
  policy. No new UI component or styling is introduced by this task.

Integrated lint/typecheck/build, complete CI census/rails, independent Machinist
review completion and signatures are coordinated by Canopus. Their final results
must be recorded against the exact released source; earlier task results are not
substitutes. No new failure remains in the focused suites. Unrelated existing
warnings or optional rail failures must remain separately disclosed if observed.

## Acceptance still requiring release evidence

| Criterion | Current evidence and remaining check |
| --- | --- |
| AC1: old/direct/optimizer draft URLs denied | Mocked checked-route denials and optimizer config PASS; live historical public URLs, direct Storage and crafted optimizer requests pending. |
| AC2: published delivery remains usable | All nine synthetic variants preserve bytes/MIME; live published variants and page image delivery pending. |
| AC3: owner preview and hostile inputs | Actual auth/route code with synthetic sessions PASS; no real owner session accessed. Personal owner end-to-end check remains the user's if needed. |
| AC4: private drafts and immediate unpublish | Same-key transition, download-time denial and no-cache tests PASS; private bucket state and effective guest download/sign/list policies pending live proof. |
| AC5: originals/objects/body preservation | Raw body/patch tests PASS; root reports no existing embedded legacy references. Before/after original and derivative counts still require release comparison. |
| AC6: exact deployed gates | Focused 173 cases and targeted lint PASS; integrated/remote gates and post-propagation guest smoke pending. |

No rollback may restore a public photos bucket. Previously downloaded copies
cannot be revoked. The independently noted build-time Pagefind stale-metadata
risk is outside this scoped image fix and remains a separate disclosed issue.
