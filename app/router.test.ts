import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { db } from './data/db.ts'
import { authorizedUsers, users } from './data/schema.ts'
import { router } from './router.ts'
import { routes } from './routes.ts'
import { authCookieHeader, hasTestDatabase, uniqueEmail } from '../test/helpers.ts'

describe('home', () => {
  it('shows a sign-in link when signed out', async () => {
    let response = await router.fetch(new Request('http://localhost' + routes.home.href()))

    assert.equal(response.status, 200)
    assert.match(await response.text(), /Sign in with Google/)
  })
})

describe('unknown routes', () => {
  it('404s', async () => {
    let response = await router.fetch(new Request('http://localhost/this-route-does-not-exist'))
    assert.equal(response.status, 404)
  })
})

describe('google sign-in', () => {
  it('GET /auth/google redirects to Google without hitting the network', async () => {
    let response = await router.fetch(
      new Request('http://localhost' + routes.auth.google.index.href(), { redirect: 'manual' }),
    )

    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.match(location, /^https:\/\/accounts\.google\.com\//)
  })
})

describe('protected routes without a session', () => {
  it('rejects GET /settings', async () => {
    let response = await router.fetch(
      new Request('http://localhost' + routes.settings.index.href()),
    )
    assert.equal(response.ok, false)
  })

  it('rejects POST /notebook/provision', async () => {
    let response = await router.fetch(
      new Request('http://localhost' + routes.notebook.provision.href(), { method: 'POST' }),
    )
    assert.equal(response.ok, false)
  })
})

describe('notebook iframe proxy', () => {
  it('404s for an unauthenticated request instead of falling through to routing', async () => {
    let response = await router.fetch(new Request('http://localhost/notebook/app/'))
    assert.equal(response.status, 404)
  })

  if (!hasTestDatabase) {
    it.skip('requires DATABASE_URL', () => {})
    return
  }

  it("404s for an authenticated user who hasn't provisioned a sprite", async () => {
    let email = uniqueEmail('notebook-proxy-route')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'No Sprite Yet' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'member', added_by: 'test' })
    let cookie = await authCookieHeader(user.id)

    let response = await router.fetch(
      new Request('http://localhost/notebook/app/', { headers: { Cookie: cookie } }),
    )
    assert.equal(response.status, 404)
  })
})

describe('csrf protection', () => {
  if (!hasTestDatabase) {
    it.skip('requires DATABASE_URL', () => {})
    return
  }

  it('rejects a POST from an authenticated session with no csrf token', async () => {
    let email = uniqueEmail('csrf')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'CSRF Test' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'member', added_by: 'test' })
    let cookie = await authCookieHeader(user.id)

    let response = await router.fetch(
      new Request('http://localhost' + routes.notebook.destroy.href(), {
        method: 'POST',
        headers: { Cookie: cookie },
      }),
    )

    assert.equal(response.ok, false)
  })
})

describe('settings page access control', () => {
  if (!hasTestDatabase) {
    it.skip('requires DATABASE_URL', () => {})
    return
  }

  it('lets an authenticated admin view the authorized users list', async () => {
    let email = uniqueEmail('admin')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'Admin Test' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'admin', added_by: 'test' })
    let cookie = await authCookieHeader(user.id)

    let response = await router.fetch(
      new Request('http://localhost' + routes.settings.index.href(), {
        headers: { Cookie: cookie },
      }),
    )

    assert.equal(response.status, 200)
    assert.match(await response.text(), new RegExp(email))
  })

  it('lets an authenticated non-admin member view their profile without user management', async () => {
    let email = uniqueEmail('member')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'Member Test' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'member', added_by: 'test' })
    let cookie = await authCookieHeader(user.id)

    let response = await router.fetch(
      new Request('http://localhost' + routes.settings.index.href(), {
        headers: { Cookie: cookie },
      }),
    )

    assert.equal(response.status, 200)
    let text = await response.text()
    assert.match(text, new RegExp(email))
    assert.doesNotMatch(text, /Authorized users/)
  })

  it('rejects a non-admin POST to /admin/users with 403', async () => {
    let email = uniqueEmail('member')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'Member Test' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'member', added_by: 'test' })
    let cookie = await authCookieHeader(user.id)

    let response = await router.fetch(
      new Request('http://localhost' + routes.admin.addUser.href(), {
        method: 'POST',
        headers: { Cookie: cookie },
      }),
    )

    assert.equal(response.status, 403)
  })

  it('rejects a session for a user that was removed from authorized_users', async () => {
    let email = uniqueEmail('deauthorized')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'Formerly Authorized' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'admin', added_by: 'test' })
    let cookie = await authCookieHeader(user.id)

    // Confirm the session works before revocation, then revoke and re-check.
    let before = await router.fetch(
      new Request('http://localhost' + routes.settings.index.href(), {
        headers: { Cookie: cookie },
      }),
    )
    assert.equal(before.status, 200)

    await db.delete(authorizedUsers, email)

    let after = await router.fetch(
      new Request('http://localhost' + routes.settings.index.href(), {
        headers: { Cookie: cookie },
      }),
    )
    assert.equal(after.ok, false)
  })
})

describe('home page when signed in', () => {
  if (!hasTestDatabase) {
    it.skip('requires DATABASE_URL', () => {})
    return
  }

  it('offers to set up a notebook for a user with no sprite yet', async () => {
    let email = uniqueEmail('newmember')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'New Member' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'member', added_by: 'test' })
    let cookie = await authCookieHeader(user.id)

    let response = await router.fetch(
      new Request('http://localhost' + routes.home.href(), { headers: { Cookie: cookie } }),
    )

    assert.equal(response.status, 200)
    let text = await response.text()
    assert.match(text, /You have not yet initialized your notebook server\./)
    assert.match(text, /aria-label="New Member"/)
  })
})
