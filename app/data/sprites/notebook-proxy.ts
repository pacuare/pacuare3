// Proxies the embedded notebook iframe through our own origin instead of the
// sprite's cross-site domain.
//
// Why: the iframe used to point straight at the sprite's own URL. marimo
// authenticates with a `SameSite=Lax` session cookie, but a cross-site iframe
// never sends that cookie on anything after the first navigation (WS
// handshake, API calls) -- browsers compute SameSite eligibility from the
// whole frame ancestry, not just the immediate document. Every one of those
// requests then looks unauthenticated, marimo redirects to its login page,
// and that page hard-codes `X-Frame-Options: DENY`, so the iframe goes
// blank. Serving the notebook from our own origin makes the cookie first
// party again, and injecting a Bearer token server-side means we never
// depend on that cookie in the first place.

import { createFetchProxy } from 'remix/fetch-proxy'

import { db } from '../db.ts'
import { userSprites } from '../schema.ts'
import { verifySessionAuth, type AppUser } from '../../middleware/auth.ts'
import { sessionCookie, sessionStorage } from '../../middleware/session.ts'

export const NOTEBOOK_PROXY_PREFIX = '/notebook/app'

export function isNotebookProxyPath(pathname: string): boolean {
  return pathname === NOTEBOOK_PROXY_PREFIX || pathname.startsWith(`${NOTEBOOK_PROXY_PREFIX}/`)
}

export interface NotebookProxyTarget {
  url: string
  token: string
}

/** Resolves the raw `Cookie` header (from either a fetch `Request` or a Node upgrade request) to the current user's own ready notebook, or `null` if there isn't one. */
export async function resolveNotebookTarget(
  cookieHeader: string | null | undefined,
): Promise<NotebookProxyTarget | null> {
  let sessionId = await sessionCookie.parse(cookieHeader ?? null)
  if (!sessionId) return null

  let session = await sessionStorage.read(sessionId)
  let authValue = session.get('auth') as { userId: number } | undefined
  if (!authValue) return null

  let user: AppUser | null = await verifySessionAuth(authValue)
  if (!user) return null

  let sprite = await db.findOne(userSprites, { where: { user_id: user.id } })
  if (!sprite || sprite.status !== 'ready' || !sprite.notebook_url || !sprite.notebook_token) {
    return null
  }

  return { url: sprite.notebook_url, token: sprite.notebook_token }
}

function upstreamPathFor(pathname: string, search: string): string {
  let rest = pathname.slice(NOTEBOOK_PROXY_PREFIX.length) || '/'
  return `${rest}${search}`
}

/** Proxies one HTTP request through to the target sprite's marimo server, authenticating with a Bearer token instead of relying on marimo's own cookie. */
export async function proxyNotebookRequest(
  request: Request,
  target: NotebookProxyTarget,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<Response> {
  let url = new URL(request.url)

  let headers = new Headers(request.headers)
  // Never forward our own (or any) cookie upstream: the sprite runs the
  // user's own arbitrary notebook code, and our httpOnly cookie is still
  // readable by the server process it's sent to.
  headers.delete('Cookie')
  headers.set('Authorization', `Bearer ${target.token}`)

  let init: RequestInit = { method: request.method, headers }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    ;(init as { duplex?: 'half' }).duplex = 'half'
  }

  let upstreamRequest = new Request(
    new URL(upstreamPathFor(url.pathname, url.search), 'http://notebook-proxy.internal'),
    init,
  )

  let proxy = createFetchProxy(target.url, { fetch: fetchImpl })
  return proxy(upstreamRequest)
}

/** Path + query to dial upstream for a raw WebSocket upgrade (used from `server.ts`, outside the fetch-based router). */
export function upstreamWsPath(requestUrl: string): string {
  let url = new URL(requestUrl, 'http://notebook-proxy.internal')
  return upstreamPathFor(url.pathname, url.search)
}
