'use client'
/**
 * Console authentication shell — rendered by /console when unauthenticated.
 * Native GET navigation starts server-side Google OAuth and its PKCE cookies.
 * Error text comes only from this fixed map, never a provider/query message.
 * Owner: Sirius (α-SUR-01) · console-google-oauth
 * Patterns: existing ConsoleLogin dark register; ConsoleApp focus treatment;
 * worldline-design instrument type and hairline-framed action atoms.
 */

import { useEffect, useState, type FormEvent } from 'react'

function loginErrorMessage(errorCode?: string): string | null {
  switch (errorCode) {
    case undefined:
      return null
    case 'access_denied':
      return 'This Google account does not have console access.'
    case 'oauth_unavailable':
      return 'Google sign-in is unavailable. Please try again later.'
    default:
      return 'Google sign-in could not be completed. Please try again.'
  }
}

const LOGIN_CSS = `
/* Resolve ink channels on this local night register; root-derived ink tokens
   otherwise retain the document theme when inherited into a dark child. */
.console-login {
  min-height: 100dvh; display: flex; align-items: center; justify-content: center;
  padding: 1rem; background: var(--console-ground);
  color: rgb(var(--ink-rgb)); font-family: var(--font-mono);
}
.console-login-panel {
  width: 100%; max-width: 360px; padding: 2rem;
  border: 1px solid rgb(var(--ink-rgb) / 0.12);
}
.console-login-title {
  margin: 0 0 1rem; font: inherit; font-size: 0.75rem;
  letter-spacing: var(--meta-tracking-read); text-transform: uppercase;
}
.console-login-copy, .console-login-error {
  margin: 0 0 1.5rem; font-size: 0.75rem; line-height: 1.7;
}
.console-login-error { color: var(--status-error); }
.console-login-button {
  width: 100%; min-height: 44px; padding: 0.75rem;
  background: rgb(var(--ink-rgb) / 0.12); border: 1px solid rgb(var(--ink-rgb) / 0.25);
  border-radius: 0; color: inherit; font: inherit; font-size: 0.75rem;
  letter-spacing: 0.04em; cursor: pointer;
}
.console-login-button:focus-visible {
  outline: 1px dashed var(--accent-orange); outline-offset: 4px;
}
.console-login-button:disabled { cursor: wait; }
@media (hover: hover) and (pointer: fine) {
  .console-login-button:hover:not(:disabled) { border-color: currentColor; }
}
`

export function ConsoleLogin({ errorCode }: { errorCode?: string }) {
  const [pending, setPending] = useState(false)
  const error = loginErrorMessage(errorCode)

  useEffect(() => {
    // A browser Back from Google may restore this page with its pending state.
    const resetPending = () => setPending(false)
    window.addEventListener('pageshow', resetPending)
    return () => window.removeEventListener('pageshow', resetPending)
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (pending) {
      event.preventDefault()
      return
    }
    setPending(true)
  }

  return (
    <main className="console-login" data-theme="dark" aria-labelledby="console-login-title">
      <style>{LOGIN_CSS}</style>
      <div className="console-login-panel">
        <h1 id="console-login-title" className="console-login-title">
          WORLDLINE · CONSOLE
        </h1>
        <p id="console-login-help" className="console-login-copy">Owner access only.</p>
        <form action="/api/auth/google" method="get" onSubmit={handleSubmit} aria-busy={pending}>
          {error && !pending && (
            <p id="console-login-error" className="console-login-error" role="alert">{error}</p>
          )}
          <button
            type="submit"
            className="console-login-button"
            disabled={pending}
            aria-describedby={error && !pending ? 'console-login-help console-login-error' : 'console-login-help'}
          >
            {pending ? 'Redirecting to Google…' : 'Continue with Google'}
          </button>
        </form>
      </div>
    </main>
  )
}
