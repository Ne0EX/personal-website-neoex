/**
 * lib/store/supabase/anon.ts
 * ---------------------------------------------------------------------------
 * Module-singleton anon Supabase client.
 *
 * contract:
 *   - Uses the publishable key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) — safe in
 *     the client bundle. Never uses SUPABASE_SECRET_KEY.
 *   - No cookies — safe at build time (generateStaticParams) and in Server
 *     Components that don't need auth context.
 *   - RLS enforces: anon sees published rows only; column grants enforce privacy
 *     layer 2 (coords/original_key hidden from anon — spec §3.2/DL13).
 *   - All anon reads MUST enumerate columns explicitly (never `select('*')`)
 *     because DL13 column grants make star-select fail for anon.
 *
 * Owner: Altair (α-BND-02) · store-as-source S4
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

// Module singleton — safe to share across requests because this client carries
// no user state (no cookies, no session). A new instance per request is not
// required here (contrast: server.ts which MUST be per-request).
export const anonClient = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    // Do not attempt to persist session or auto-refresh — anon reads only.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
