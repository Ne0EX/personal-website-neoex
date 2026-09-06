# Console Google OAuth QA

Date: 2026-09-07. Agent: Algol · α-VER-06.
Task: TASK-2026-09-06-CONSOLE-GOOGLE-OAUTH.

## Current verdict

PASS for the implemented authorization, logout, local runtime, and Vercel preview
failure/anonymous behavior. The Google provider is still disabled, so successful
Google sign-in is not ready and the full user objective is not complete. Peat
completes the personal sign-in after provider setup. No production release or
successful owner authentication is claimed here.

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
owner results. Mutations operate on disposable copies only. The resulting source
regression suite passed all 33 cases; the combined OAuth/security run passed all
112 cases with zero failures or skips. The console audit itself passed all 44
checks with zero violations.

## Verification evidence and limits

- Fresh baseline after `npm ci`: 44 existing console/nav/security tests passed.
  The earlier missing-`tsx` failures were a dependency prerequisite, resolved
  before baseline verification.
- `node --test tests/console-google-oauth.test.mjs`: 79 passed, zero failed,
  zero skipped after the final OAuth/logout test additions.
- Final explicit ESLint on the detector and both changed test files,
  `npx --no-install tsc --noEmit`, and `git diff --check` all passed after the
  detector repair.
- Read-through confirms shared Google identity checks at both `assertOwner` and
  proxy, page guards before private reads, existing membership/RLS preservation,
  no new service-role runtime access, and no private provider error reflection.
- Canopus completed isolated integrated lint/typecheck/Next/Pagefind build.
  Algol independently verified its production server on port 3087 using the
  existing public Supabase settings. The earlier local dev error came from
  missing public environment configuration, not from the OAuth implementation.
- Algol's real local HTTP checks passed: console and nested editor return 200
  with only the Google login action; access-denied query gives fixed copy;
  missing callback code returns 303 with oauth_failed and no-store; auth probe
  returns 401 AUTH; logout GET returns 405; hostile-origin logout POST returns
  403 AUTH; Google start returns the truthful oauth_unavailable redirect.
- Algol independently viewed Sirius's 1280×800 production screenshot at
  `.claude/visual-diffs/TASK-2026-09-06-CONSOLE-GOOGLE-OAUTH-sirius/after/login-desktop-focus.png`:
  readable centered dark panel, Google as the sole login action, visible keyboard
  focus, and no visible overflow. Sirius measured a 44px action and foreground
  rgb(216,224,222) against rgb(10,10,10). Mobile rendering and a numerical
  Lighthouse accessibility score were not verified after browser transport
  failure; no pass is claimed for those checks.

## Remote release evidence

Root independently verified GitHub CI run `34048836057` completed SUCCESS for
commit `352a80c8ce42ff529774505a60ed0fe936288d27`. The Vercel preview for that
same commit is READY at
`https://personal-website-neoex-dzly92mui.vercel.app`.

Canopus accessed the protected preview using Vercel's temporary share mechanism,
without changing deployment protection. Nine HTTP smoke cases passed:

| Request | Observed result |
| --- | --- |
| GET /console | 200, Google-only login |
| GET /console/editor | 200, Google-only login |
| GET /console?auth_error=access_denied | Fixed account-denied copy |
| GET /api/auth/google | 303, oauth_unavailable |
| GET /api/auth/callback without code | 303, oauth_failed |
| GET /api/console/auth-probe | 401 |
| GET /api/auth/logout | 405 |
| POST /api/auth/logout with hostile Origin | 403 |
| POST /api/auth/logout with same-origin anonymous request | 303 |

Redirects retain the exact preview HTTPS origin; OAuth responses are private,
no-store, and no-referrer. The earlier SSO 302 from the protected preview was not
counted as an application smoke result. No share token or session cookie is
included in this report.

The live provider setup remains unsaved after browser transport failures; root
confirmed Google is disabled. This is the remaining functional blocker, so the
unavailable redirect is verified graceful failure, not a successful OAuth flow.
Public production-alias deployment and the owner's personal login remain open.

Automatic post-edit hooks operate in the outer checkout and had one concurrent
build-lock failure; root recovery subsequently passed. Those outer hooks are
not substituted for the isolated integrated build. Canopus is producing scoped
temporary-checkout signatures so concurrent peers' files are not attributed to
Algol. Signature integrity is audited separately after this report is finalized.
