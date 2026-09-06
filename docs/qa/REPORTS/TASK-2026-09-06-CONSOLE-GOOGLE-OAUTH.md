# Console Google OAuth QA

Date: 2026-09-07. Agent: Algol · α-VER-06.
Task: TASK-2026-09-06-CONSOLE-GOOGLE-OAUTH.

## Current verdict

The implemented OAuth and logout behavior passed all 79 deterministic tests.
Production-provider configuration, deployed behavior, and final release/signature
evidence remain separate acceptance items. Peat completes the personal sign-in.

Verification uses `/private/tmp/personal-website-console-google-oauth`, based on
production commit `09f69ddf80f7a2517989322f3e2ac55964096304`. The original dirty
checkout is preserved and was not used as the production source baseline.
The earlier approval rejection was resolved by Peat's direct confirmation.

## Implemented behavior checked

`tests/console-google-oauth.test.mjs` executes production TypeScript with a mocked
Supabase boundary. The PKCE case uses the installed Supabase SSR SDK and an
isolated cookie store. Client logout cases execute the actual event handler
with controlled state, requests, and navigation. Tests require no real account,
secret, persisted browser session, network request, or tracked-file mutation.

The 79 passing cases cover:

- Verified Google identity and normalized owner email, including identity linking
  to an existing email account; rejection of wrong-email, password-only,
  missing/unverified/mismatched Google identities and editable-metadata spoofing.
- Server token validation before strict `is_owner === true` membership, with
  fail-closed API/RPC errors and exceptions that expose no provider details.
- Both console pages denying access before administrative reads; the auth
  probe's 401 envelope; proxy denial and preserved stale-cookie cleanup.
- Google account chooser, fixed callback, ignored hostile destination and
  forwarded-host input, uncached redirects, bounded provider readiness check,
  missing configuration, disabled provider, and provider failures.
- Real SDK PKCE verifier-cookie/challenge generation; callback exchange before
  owner validation; missing, invalid, repeated, duplicate, or conflicting codes;
  denied-session local sign-out and sign-out failure handling.
- Google-only native login form and fixed accessible error messages, including
  an untrusted query value that is not reflected into the message.
- Same-origin POST logout, denial of absent/hostile origins before session
  access, provider failures, local sign-out, full navigation after success,
  accessible retry, unsaved-change cancellation, and duplicate-submit protection.

The test is required in `tests/harness/ci-test-census.json`.

## Source-audit compatibility repair

The required console audit's old regex required exactly `return <ConsoleLogin />`
inside an otherwise empty denied branch. It rejected the approved page's safe
query parsing and `errorCode` prop despite the unchanged authorization order.

`scripts/audit-security-netra-contracts.ts` now checks the page's syntax tree:
owner validation must be the first statement; the failed-auth branch must be
second and end by returning `ConsoleLogin`. Before that return it permits only
variable declarations, rejects calls/constructors/tagged templates including in
JSX props, and permits only `await searchParams` as asynchronous presentation
work. This also rejects data access before authorization that the old regex did
not inspect.

Twelve added mutation cases in `tests/security-netra-contracts.test.mjs` cover
both console pages: loading before auth, loading inside denial, loading through
login props, inverted guards, returning admin UI on failure, and fabricated
owner results. Mutations operate on disposable copies only. The final source
sensor rerun belongs to the integrated check evidence; no unrun result is claimed
by this report revision.

## Verification evidence and limits

- Fresh baseline after `npm ci`: 44 existing console/nav/security tests passed.
  The earlier missing-`tsx` failures were a dependency prerequisite, resolved
  before baseline verification.
- `node --test tests/console-google-oauth.test.mjs`: 79 passed, zero failed,
  zero skipped after the final OAuth/logout test additions.
- Explicit test ESLint and `git diff --check` passed before the detector repair;
  those commands must run on the final detector/test change too.
- Read-through confirms shared Google identity checks at both `assertOwner` and
  proxy, page guards before private reads, existing membership/RLS preservation,
  no new service-role runtime access, and no private provider error reflection.
- Canopus reported a passing isolated integrated lint/typecheck/Next/Pagefind
  build. Browser QA proceeds on its production server at port 3087 using the
  existing public Supabase settings. The earlier local dev error came from
  missing public environment configuration, not from the OAuth implementation.
- Sirius reported an inspected 1280px production render with no overflow, a
  44px action, keyboard focus, and corrected contrast in the nested dark panel;
  independent QA browser and HTTP results remain to be recorded.

Automatic post-edit hooks operate in the outer checkout and had one concurrent
build-lock failure; root recovery subsequently passed. Those outer hooks are
not substituted for the isolated integrated build. Canopus is producing scoped
temporary-checkout signatures so concurrent peers' files are not attributed to
Algol. Final signature integrity and production release evidence remain pending.
