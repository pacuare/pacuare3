import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { db } from '../db.ts'
import { userSprites, users, type User } from '../schema.ts'
import { hasTestDatabase, uniqueEmail } from '../../../test/helpers.ts'
import {
  destroyUserSprite,
  extractMarimoAccessToken,
  provisionUserSprite,
  spriteNameForUser,
  type ProvisionDeps,
} from './provision.ts'
import type { ServiceLogEvent, SpriteInfo, SpritesClientLike } from './client.ts'

describe('spriteNameForUser', () => {
  it('slugifies the email and prefixes it with the numeric id', () => {
    assert.equal(spriteNameForUser(7, 'Alice@Example.com'), 'pacuare-7-alice-example-com')
  })

  it('collapses punctuation runs into single dashes', () => {
    assert.equal(spriteNameForUser(1, 'a.b+test@x.com'), 'pacuare-1-a-b-test-x-com')
  })

  it('disambiguates two emails that would otherwise slugify identically', () => {
    let a = spriteNameForUser(1, 'a.b@x.com')
    let b = spriteNameForUser(2, 'a-b@x.com')
    assert.notEqual(a, b)
  })
})

describe('extractMarimoAccessToken', () => {
  it('finds the token in marimo\'s startup log line', () => {
    let events: ServiceLogEvent[] = [
      { type: 'stdout', data: 'Starting marimo...\n', timestamp: 1 },
      {
        type: 'stdout',
        data: 'URL: http://0.0.0.0:8080/?access_token=abc123-XYZ_789\n',
        timestamp: 2,
      },
    ]
    assert.equal(extractMarimoAccessToken(events), 'abc123-XYZ_789')
  })

  it('returns null when no log line contains a token', () => {
    let events: ServiceLogEvent[] = [{ type: 'started', timestamp: 1 }]
    assert.equal(extractMarimoAccessToken(events), null)
  })
})

describe('provisionUserSprite / destroyUserSprite', () => {
  if (!hasTestDatabase) {
    it.skip('requires DATABASE_URL', () => {})
    return
  }

  async function createTestUser(): Promise<User> {
    return db.create(
      users,
      {
        email: uniqueEmail('provision'),
        google_sub: uniqueEmail('sub'),
        name: 'Test User',
      },
      { returnRow: true },
    )
  }

  function fakeSprites(overrides: Partial<SpritesClientLike> = {}): SpritesClientLike {
    let info: SpriteInfo = { id: 'x', name: 'sprite', organization: 'org', status: 'running', url: 'https://sprite.test' }
    return {
      async createSprite(name) {
        return { ...info, name }
      },
      async getSprite(name) {
        return { ...info, name }
      },
      async deleteSprite() {},
      async updateUrlSettings(name) {
        return { ...info, name }
      },
      async writeFile() {},
      async createService(_name, serviceName) {
        if (serviceName === 'marimo') {
          return [
            {
              type: 'stdout',
              data: 'URL: http://0.0.0.0:8080/?access_token=fake-token-123',
              timestamp: 1,
            },
          ]
        }
        return []
      },
      ...overrides,
    }
  }

  it('creates a ready user_sprites row on success', async () => {
    let user = await createTestUser()
    let deps: ProvisionDeps = {
      sprites: fakeSprites(),
      exportPacuareRaw: async () => ({ columns: ['id'], rows: [['1']] }),
    }

    await provisionUserSprite(user, deps)

    let record = await db.findOne(userSprites, { where: { user_id: user.id } })
    assert.ok(record)
    assert.equal(record!.status, 'ready')
    assert.equal(record!.notebook_url, 'https://sprite.test')
    assert.equal(record!.notebook_token, 'fake-token-123')
    assert.equal(record!.name, spriteNameForUser(user.id, user.email))
  })

  it('is idempotent: calling it again re-provisions the same sprite record', async () => {
    let user = await createTestUser()
    let deps: ProvisionDeps = {
      sprites: fakeSprites(),
      exportPacuareRaw: async () => ({ columns: ['id'], rows: [] }),
    }

    await provisionUserSprite(user, deps)
    let first = await db.findOne(userSprites, { where: { user_id: user.id } })

    await provisionUserSprite(user, deps)
    let second = await db.findOne(userSprites, { where: { user_id: user.id } })

    assert.equal(first!.id, second!.id)
    assert.equal(second!.status, 'ready')
  })

  it('records the failure and re-throws when a Sprites API call fails', async () => {
    let user = await createTestUser()
    let deps: ProvisionDeps = {
      sprites: fakeSprites({
        async createSprite() {
          throw new Error('boom')
        },
      }),
      exportPacuareRaw: async () => ({ columns: [], rows: [] }),
    }

    await assert.rejects(() => provisionUserSprite(user, deps))

    let record = await db.findOne(userSprites, { where: { user_id: user.id } })
    assert.equal(record!.status, 'error')
    assert.equal(record!.last_error, 'boom')
  })

  it('destroy marks the record deleted and clears the notebook url and token', async () => {
    let user = await createTestUser()
    let deps: ProvisionDeps = {
      sprites: fakeSprites(),
      exportPacuareRaw: async () => ({ columns: ['id'], rows: [] }),
    }
    await provisionUserSprite(user, deps)

    let deletedNames: string[] = []
    await destroyUserSprite(user, {
      ...deps,
      sprites: fakeSprites({
        async deleteSprite(name) {
          deletedNames.push(name)
        },
      }),
    })

    let record = await db.findOne(userSprites, { where: { user_id: user.id } })
    assert.equal(record!.status, 'deleted')
    assert.equal(record!.notebook_url, null)
    assert.equal(record!.notebook_token, null)
    assert.deepEqual(deletedNames, [spriteNameForUser(user.id, user.email)])
  })

  it('destroy is a no-op when the user never provisioned a sprite', async () => {
    let user = await createTestUser()
    await destroyUserSprite(user, {
      sprites: fakeSprites({
        async deleteSprite() {
          throw new Error('should not be called')
        },
      }),
      exportPacuareRaw: async () => ({ columns: [], rows: [] }),
    })

    let record = await db.findOne(userSprites, { where: { user_id: user.id } })
    assert.equal(record, null)
  })
})
