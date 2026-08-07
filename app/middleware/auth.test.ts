import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { db } from '../data/db.ts'
import { authorizedUsers, users } from '../data/schema.ts'
import { hasTestDatabase, uniqueEmail } from '../../test/helpers.ts'
import { verifySessionAuth } from './auth.ts'

describe('verifySessionAuth', () => {
  if (!hasTestDatabase) {
    it.skip('requires DATABASE_URL', () => {})
    return
  }

  it('returns null for an unknown session userId', async () => {
    let result = await verifySessionAuth({ userId: -1 })
    assert.equal(result, null)
  })

  it('returns null when the user exists but is not on the authorized list', async () => {
    let email = uniqueEmail('unauthorized')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'Nobody' },
      { returnRow: true },
    )

    let result = await verifySessionAuth({ userId: user.id })
    assert.equal(result, null)
  })

  it('returns the AppUser, with role from authorized_users, when authorized', async () => {
    let email = uniqueEmail('member')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'Member Person', picture_url: 'https://pic' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'member', added_by: 'test' })

    let result = await verifySessionAuth({ userId: user.id })

    assert.ok(result)
    assert.equal(result!.email, email)
    assert.equal(result!.role, 'member')
    assert.equal(result!.pictureUrl, 'https://pic')
  })

  it('stops authenticating the moment the email is removed from authorized_users', async () => {
    let email = uniqueEmail('revoked')
    let user = await db.create(
      users,
      { email, google_sub: uniqueEmail('sub'), name: 'Soon Revoked' },
      { returnRow: true },
    )
    await db.create(authorizedUsers, { email, role: 'admin', added_by: 'test' })

    let before = await verifySessionAuth({ userId: user.id })
    assert.ok(before)
    assert.equal(before!.role, 'admin')

    await db.delete(authorizedUsers, email)

    let after = await verifySessionAuth({ userId: user.id })
    assert.equal(after, null)
  })
})
