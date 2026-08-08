import type { Middleware } from 'remix/router'

import {
  isNotebookProxyPath,
  proxyNotebookRequest,
  resolveNotebookTarget,
} from '../data/docker/notebook-proxy.ts'

/**
 * Proxies `/notebook/app/*` through to the current user's own space. Runs
 * ahead of `formData()`/`csrf()` and short-circuits: marimo's own POST/PUT
 * bodies and headers need to reach it byte-for-byte, and its requests don't
 * carry our CSRF synchronizer token.
 */
export function notebookProxy(): Middleware {
  return async (context, next) => {
    if (!isNotebookProxyPath(context.url.pathname)) {
      return next()
    }

    let target = await resolveNotebookTarget(context.request.headers.get('Cookie'))
    if (!target) {
      return new Response('Not Found', { status: 404 })
    }

    return proxyNotebookRequest(context.request, target)
  }
}
