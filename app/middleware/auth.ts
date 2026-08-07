import { createGoogleAuthProvider } from 'remix/auth'
import { Auth, auth, createSessionAuthScheme } from 'remix/middleware/auth'
import type { AuthState } from 'remix/middleware/auth'
import type { Middleware } from 'remix/router'

import { db } from '../data/db.ts'
import { authorizedUsers, users } from '../data/schema.ts'
import { env } from '../data/env.ts'
import { routes } from '../routes.ts'

export interface AppUser {
  id: number
  email: string
  name: string
  pictureUrl: string | null
  role: 'admin' | 'member'
}

export const googleProvider = createGoogleAuthProvider({
  clientId: env.googleClientId,
  clientSecret: env.googleClientSecret,
  redirectUri: new URL(routes.auth.google.callback.href(), env.appOrigin),
})

export interface SessionAuthValue {
  userId: number
}

/**
 * Resolves a session's `{ userId }` record into the current `AppUser`, or
 * `null` if the session no longer authenticates. Exported (rather than
 * inlined into `loadAuth()`) so the revocation behavior is directly
 * testable: re-checks `authorized_users` on every call, so removing a user
 * from the allowlist -- or demoting an admin -- takes effect on their very
 * next request, without needing to touch `users`.
 */
export async function verifySessionAuth(value: SessionAuthValue): Promise<AppUser | null> {
  let user = await db.find(users, value.userId)
  if (!user) return null

  let authorized = await db.findOne(authorizedUsers, { where: { email: user.email } })
  if (!authorized) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pictureUrl: user.picture_url,
    role: authorized.role,
  }
}

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme<AppUser, SessionAuthValue>({
        read(session) {
          return (session.get('auth') as SessionAuthValue | undefined) ?? null
        },
        verify: verifySessionAuth,
        invalidate(session) {
          session.unset('auth')
        },
      }),
    ],
  })
}

export function requireAdmin(): Middleware {
  return async (context, next) => {
    let state = context.get(Auth) as AuthState<AppUser> | undefined
    if (!state?.ok || state.identity.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }
    return next()
  }
}
