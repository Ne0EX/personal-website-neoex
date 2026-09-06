import { NextResponse } from 'next/server'

export type ConsoleOAuthError = 'oauth_failed' | 'access_denied' | 'oauth_unavailable'

/** OAuth responses contain one-use authorization state and must never be cached. */
export function oauthRedirect(destination: URL | string): NextResponse {
  const response = NextResponse.redirect(destination, 303)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}

export function consoleOAuthRedirect(request: Request, error?: ConsoleOAuthError): NextResponse {
  // No caller-supplied destination or forwarded host is accepted.
  const destination = new URL('/console', request.url)
  if (error) destination.searchParams.set('auth_error', error)
  return oauthRedirect(destination)
}
