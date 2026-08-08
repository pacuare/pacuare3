import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { db } from '../db.ts'
import { authorizedUsers, spaces, users, type User } from '../schema.ts'
import { authCookieHeader, hasTestDatabase, uniqueEmail } from '../../../test/helpers.ts'
import {
  isNotebookProxyPath,
  proxyNotebookRequest,
  resolveNotebookTarget,
  upstreamWsPath,
} from './notebook-proxy.ts'

describe('isNotebookProxyPath', () => {
  it('matches the bare prefix and anything nested under it', () => {
    assert.ok(isNotebookProxyPath('/notebook/app'))
    assert.ok(isNotebookProxyPath('/notebook/app/'))
    assert.ok(isNotebookProxyPath('/notebook/app/ws'))
    assert.ok(isNotebookProxyPath('/notebook/app/api/kernel/execute'))
  })

  it('does not match unrelated paths, including near-miss prefixes', () => {
    assert.equal(isNotebookProxyPath('/notebook/provision'), false)
    assert.equal(isNotebookProxyPath('/notebook/appendix'), false)
    assert.equal(isNotebookProxyPath('/'), false)
  })
})

describe('upstreamWsPath', () => {
  it('strips the proxy prefix and keeps the query string', () => {
    assert.equal(upstreamWsPath('/notebook/app/ws?session_id=abc'), '/ws?session_id=abc')
  })

  it('maps the bare prefix to the upstream root', () => {
    assert.equal(upstreamWsPath('/notebook/app'), '/')
    assert.equal(upstreamWsPath('/notebook/app/'), '/')
  })
})

describe('resolveNotebookTarget', () => {
  if (!hasTestDatabase) {
    it.skip('requires DATABASE_URL', () => {})
    return
  }

  async function createAuthorizedUser(): Promise<User> {
    let email = uniqueEmail('notebook-proxy')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'Notebook Proxy Test' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'member', added_by: 'test' })
    return user
  }

  it('returns null with no cookie at all', async () => {
    assert.equal(await resolveNotebookTarget(null), null)
  })

  it('returns null for a cookie that does not resolve to an authenticated session', async () => {
    assert.equal(await resolveNotebookTarget('pacuare_session=not-a-real-session'), null)
  })

  it('returns null when the user has no space yet', async () => {
    let user = await createAuthorizedUser()
    let cookie = await authCookieHeader(user.id)
    assert.equal(await resolveNotebookTarget(cookie), null)
  })

  it('returns null when the space exists but is not ready', async () => {
    let user = await createAuthorizedUser()
    await db.create(spaces, {
      user_id: user.id,
      name: uniqueEmail('pending-space'),
      status: 'provisioning',
    })
    let cookie = await authCookieHeader(user.id)
    assert.equal(await resolveNotebookTarget(cookie), null)
  })

  it('returns the space url and token once the space is ready', async () => {
    let user = await createAuthorizedUser()
    await db.create(spaces, {
      user_id: user.id,
      name: uniqueEmail('ready-space'),
      status: 'ready',
      notebook_url: 'http://172.19.0.5:8080',
      notebook_token: 'the-token',
    })
    let cookie = await authCookieHeader(user.id)

    assert.deepEqual(await resolveNotebookTarget(cookie), {
      url: 'http://172.19.0.5:8080',
      token: 'the-token',
    })
  })
})

describe('proxyNotebookRequest', () => {
  it('injects a Bearer token, strips the incoming cookie, and forwards the sub-path', async () => {
    let seen: { url: string; headers: Headers } | undefined
    let fakeFetch: typeof fetch = async (input, init) => {
      seen = { url: input.toString(), headers: new Headers(init?.headers) }
      return new Response('ok')
    }

    let request = new Request('http://app.example/notebook/app/api/kernel/execute?x=1', {
      method: 'POST',
      headers: { Cookie: 'pacuare_session=secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ cell: '1' }),
    })

    let response = await proxyNotebookRequest(
      request,
      { url: 'http://172.19.0.5:8080', token: 'space-token' },
      fakeFetch,
    )

    assert.equal(response.status, 200)
    assert.equal(seen?.url, 'http://172.19.0.5:8080/api/kernel/execute?x=1')
    assert.equal(seen?.headers.get('Authorization'), 'Bearer space-token')
    assert.equal(seen?.headers.get('Cookie'), null)
  })
})
