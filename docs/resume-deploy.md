# resume.neoex.dev — deployment notes

## Route

The resume page lives at `/resume` in the main Worldline repo
(`app/resume/page.tsx`). It is a Next.js App Router server component
with no dynamic data — statically generated at build time.

## Subdomain wiring (not yet wired — action required at deploy time)

### Option A — Vercel host-based rewrite (recommended)

Add a rewrite in `next.config.*` (if present) or in `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "resume.neoex.dev" }],
      "destination": "/resume/:path*"
    }
  ]
}
```

Then add `resume.neoex.dev` as an alias domain in the Vercel project
settings pointing at the same deployment as `neoex.dev`.

### Option B — Next.js middleware rewrite

Add to `middleware.ts` (Altair's territory — request to Altair):

```ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("resume.")) {
    const url = request.nextUrl.clone();
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/resume";
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
```

### DNS

Point `resume.neoex.dev` CNAME → `cname.vercel-dns.com` (same as
`neoex.dev`). Vercel handles routing per the rewrite above.

## Page metadata

Set in `app/resume/page.tsx` via the `metadata` export:

- `title`: "Krittiphong Manachamni — AI Engineer"
- `description`: AI Engineer in Bangkok...

If the subdomain is live, consider adding an `alternates.canonical`
pointing to `https://resume.neoex.dev/` so search engines attribute
the page to the subdomain rather than `neoex.dev/resume`.

## Print / PDF

The page ships a `@media print` stylesheet in `app/resume/resume.css`.
Chrome "Save as PDF" → A4 → renders ink-on-white with full content and
clean pagination. No additional tooling required.
