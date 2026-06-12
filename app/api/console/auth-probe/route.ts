// contract
// --------
// method   · GET
// path     · /api/console/auth-probe
// purpose  · S4 gate verification — confirms assertOwner() returns {ok:false,AUTH}
//            when called without a valid session. Used only in acceptance testing;
//            safe in production (returns no sensitive data on either branch).
// request  · none
// response · {ok: true, userId: string} | {ok: false, error: {code: 'AUTH', message: string}}
// error codes ·
//   401 · AUTH — no valid session or not in private.owners
// rate limit · none (console is Peat-only; no public traffic to this path)
// idempotency · read-only (GET, safe to retry)
//
// Owner: Altair (α-BND-02) · store-as-source S4

import { NextResponse } from 'next/server'
import { assertOwner } from '@/lib/server/auth'

export async function GET(): Promise<NextResponse> {
  const result = await assertOwner()

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 401 }
    )
  }

  return NextResponse.json({ ok: true, userId: result.userId }, { status: 200 })
}
