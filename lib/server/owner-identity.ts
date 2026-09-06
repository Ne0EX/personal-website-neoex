import type { User } from '@supabase/supabase-js'

const OWNER_EMAIL = 'neospiritth@gmail.com'

/** Only call with the user returned by the Auth server's getUser() check. */
export function isOwnerGoogleIdentity(user: User | null): boolean {
  if (user?.email?.toLowerCase() !== OWNER_EMAIL) return false

  // identity_data comes from the identity provider. user_metadata can be
  // edited by the user and must never grant console access.
  return user.identities?.some((identity) => {
    const data = identity.identity_data
    return identity.provider === 'google'
      && typeof data?.email === 'string'
      && data.email.toLowerCase() === OWNER_EMAIL
      && data.email_verified === true
  }) === true
}
