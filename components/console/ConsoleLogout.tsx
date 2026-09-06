'use client'
/**
 * Explicit session exit, separate from ConsoleApp's existing selection exit.
 * Pattern: ConsoleApp .ch-exit token/focus treatment and ConsoleLogin form state.
 * Contract: Altair POST /api/auth/logout clears the local session, then 303 /console.
 */

import { useState, type FormEvent } from 'react'

export function ConsoleLogout({ hasUnsavedChanges = false }: { hasUnsavedChanges?: boolean }) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (hasUnsavedChanges && !window.confirm('Sign out and discard unsaved changes?')) return

    setFailed(false)
    setPending(true)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
      if (!response.ok) throw new Error('Sign-out failed')
      // Discard the in-memory private console tree and Router Cache after session exit.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/console')
    } catch {
      setFailed(true)
      setPending(false)
    }
  }

  return (
    <form action="/api/auth/logout" method="post" onSubmit={handleSubmit} aria-busy={pending}>
      <button
        type="submit"
        className="ch-exit"
        disabled={pending}
        style={{ minHeight: 44, position: 'relative', zIndex: 3 }}
      >
        {pending ? 'Signing out…' : failed ? 'Retry sign out' : 'Sign out'}
      </button>
      {failed && <span className="sr-only" role="alert">Sign-out failed. Please try again.</span>}
    </form>
  )
}
