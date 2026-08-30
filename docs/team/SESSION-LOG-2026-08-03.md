# Session log — 2026-08-03

mode · `genesis`
owner · Polaris
status · closed at boundary

## Set out to

Finish the production handoff for Worldline: understand the console surface boundary, fix the public chrome leaking into `/console`, confirm the connected Vercel/Cloudflare/Supabase path, and leave the article corpus in a safe draft state.

## Shipped

- Moved `ThemeToggle` out of `app/layout.tsx` and into `app/[lang]/layout.tsx`. Public routes retain the register; console routes no longer render it.
- Fixed the malformed `vercel.json` comments and added a deployment-safe `.vercelignore` so Vercel can build from a small staging tree.
- Confirmed `neoex.dev` is attached to Vercel and production is ready.
- Converted all 15 Supabase article rows to `draft`; 5 published rows changed, 10 were already drafts. No article body/title was changed.
- Redeployed after the data transition so statically generated article paths are regenerated. The old article routes now return 404, while `/en` and `/console` remain available.

## Decisions

- Keep the admin surface at `/console` for now. It is large enough to be treated as a distinct product surface, but a subdomain can wait until auth, deployment, and operational boundaries need to separate.
- Keep all staged article material as drafts until Peat revisits the writing.

## Verification

- Local lint, typecheck, and production build passed.
- Production smoke passed: console and editor 200, unauthenticated auth probe 401, public theme register preserved, and article routes 404 after the draft redeploy.
- Supabase service verification: 15 article rows, all draft; public published query: 0 rows.

## Open obligations

- Peat: prepare the concert article about **Ado AO 2026** by **2026-08-05**.
- Peat: revisit and rewrite the staged article drafts later.

## Durable lessons

- Public-only UI belongs in the public route layout. A root layout wraps console routes too, so global public chrome there is a surface-boundary bug.
- A database visibility change is not enough when article routes are statically generated; redeploy after changing publish state so prebuilt HTML cannot keep serving the old article.

## Boundary

This log records the intended source changes and production state. Unrelated pre-existing worktree changes remain untouched and uncommitted.
