import { createSession } from 'remix/session'

import { sessionCookie, sessionStorage } from '../app/middleware/session.ts'

/**
 * True when real Postgres connection strings were provided (as opposed to
 * the `env.ts` test fallbacks). DB-backed integration tests are skipped
 * when this is false, so `npm test` still passes with zero infrastructure;
 * CI provisions Postgres and sets these before running the suite.
 */
export const hasTestDatabase = Boolean(process.env.DATABASE_URL)
export const hasTestDataDatabase = Boolean(process.env.DATA_DATABASE_URL)

let counter = 0

/** A unique-per-call email so DB-backed tests never collide with each other. */
export function uniqueEmail(label: string): string {
  counter += 1
  return `${label}-${Date.now()}-${counter}@example.test`
}

/** Builds a `Cookie` header that authenticates as the given user id. */
export async function authCookieHeader(userId: number): Promise<string> {
  let session = createSession()
  session.set('auth', { userId })
  let cookieValue = await sessionStorage.save(session)
  if (!cookieValue) throw new Error('expected a session cookie value')
  let setCookie = await sessionCookie.serialize(cookieValue)
  return setCookie.split(';')[0]!
}
