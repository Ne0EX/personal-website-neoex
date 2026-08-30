'use client'
/**
 * components/console/ConsoleLogin.tsx
 * ---------------------------------------------------------------------------
 * Console authentication shell — rendered by /console when unauthenticated.
 *
 * contract:
 *   - Uses createSupabaseBrowserClient().auth.signInWithPassword()
 *   - On success: router.refresh() so the Server Component re-runs and the
 *     proxy.ts session-refresh pass picks up the new cookie.
 *   - On failure: displays the error message from Supabase Auth (never leaks
 *     internal stack traces).
 *   - No signup affordance. No public nav link.
 *   - Visual idiom: console register — JetBrains Mono, sparse, functional.
 *     Sirius polishes visuals in S6; this is the functional shell.
 *
 * Owner: Altair (α-BND-02) · store-as-source S4
 * Sirius polishes in S6.
 */

import React, { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/store/supabase/browser'

export function ConsoleLogin() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }

      // Login succeeded — refresh the Server Component tree so the proxy and
      // page-level auth checks re-run with the new session cookie.
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--console-ground)',
        fontFamily: '"JetBrains Mono", "Courier New", monospace',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          padding: '2rem',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 4,
        }}
      >
        {/* Header */}
        <div
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: '0.7rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '1.5rem',
          }}
        >
          WORLDLINE · CONSOLE
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="wl-email"
              style={{
                display: 'block',
                color: 'rgba(255,255,255,0.45)',
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                marginBottom: '0.35rem',
                textTransform: 'uppercase',
              }}
            >
              Email
            </label>
            <input
              id="wl-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              disabled={loading}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 2,
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'inherit',
                fontSize: '0.8rem',
                padding: '0.5rem 0.6rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="wl-password"
              style={{
                display: 'block',
                color: 'rgba(255,255,255,0.45)',
                fontSize: '0.65rem',
                letterSpacing: '0.08em',
                marginBottom: '0.35rem',
                textTransform: 'uppercase',
              }}
            >
              Password
            </label>
            <input
              id="wl-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 2,
                color: 'rgba(255,255,255,0.85)',
                fontFamily: 'inherit',
                fontSize: '0.8rem',
                padding: '0.5rem 0.6rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Error display */}
          {error && (
            <div
              role="alert"
              style={{
                color: 'rgba(255,80,80,0.85)',
                fontSize: '0.7rem',
                marginBottom: '1rem',
                letterSpacing: '0.02em',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: '100%',
              background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2,
              color: loading ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
              fontFamily: 'inherit',
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '0.55rem',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Authenticating…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
