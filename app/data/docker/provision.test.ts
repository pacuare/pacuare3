import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { db } from '../db.ts'
import { spaces, users, type User } from '../schema.ts'
import { hasTestDatabase, uniqueEmail } from '../../../test/helpers.ts'
import type { CreateContainerOptions, DockerClientLike } from './client.ts'
import {
  destroyUserSpace,
  generateNotebookToken,
  provisionUserSpace,
  registryHostFor,
  spaceNameForUser,
  updateUserSpace,
  type ProvisionDeps,
} from './provision.ts'

describe('spaceNameForUser', () => {
  it('slugifies the email and prefixes it with the numeric id', () => {
    assert.equal(spaceNameForUser(7, 'Alice@Example.com'), 'pacuare-7-alice-example-com')
  })

  it('collapses punctuation runs into single dashes', () => {
    assert.equal(spaceNameForUser(1, 'a.b+test@x.com'), 'pacuare-1-a-b-test-x-com')
  })

  it('disambiguates two emails that would otherwise slugify identically', () => {
    let a = spaceNameForUser(1, 'a.b@x.com')
    let b = spaceNameForUser(2, 'a-b@x.com')
    assert.notEqual(a, b)
  })
})

describe('registryHostFor', () => {
  it('pulls the host out of a private-registry image ref', () => {
    assert.equal(
      registryHostFor('packages.buildkite.com/aleks-rutins/pacuare/pacuare3-notebook:latest'),
      'packages.buildkite.com',
    )
  })

  it('recognizes a host:port ref', () => {
    assert.equal(registryHostFor('localhost:5000/pacuare3-notebook:latest'), 'localhost:5000')
  })

  it('recognizes bare localhost with no port', () => {
    assert.equal(registryHostFor('localhost/pacuare3-notebook:latest'), 'localhost')
  })

  it('returns undefined for a bare Docker Hub name, which has no registry host segment', () => {
    assert.equal(registryHostFor('pacuare3-notebook:latest'), undefined)
    assert.equal(registryHostFor('library/postgres:16'), undefined)
  })
})

describe('generateNotebookToken', () => {
  it('generates a 128-character hex string, like `openssl rand -hex 64`', () => {
    let token = generateNotebookToken()
    assert.equal(token.length, 128)
    assert.ok(/^[0-9a-f]+$/.test(token))
  })

  it('generates a different token on each call', () => {
    assert.notEqual(generateNotebookToken(), generateNotebookToken())
  })
})

describe('provisionUserSpace / updateUserSpace / destroyUserSpace', () => {
  if (!hasTestDatabase) {
    it.skip('requires DATABASE_URL', () => {})
    return
  }

  async function createTestUser(): Promise<User> {
    return db.create(
      users,
      { email: uniqueEmail('provision'), google_sub: uniqueEmail('sub'), name: 'Test User' },
      { returnRow: true },
    )
  }

  interface FakeDocker {
    docker: DockerClientLike
    createContainerCalls: { name: string; options: CreateContainerOptions }[]
    putArchiveCalls: { id: string; path: string; tar: Buffer }[]
    pullImageCalls: string[]
  }

  function fakeDocker(overrides: Partial<DockerClientLike> = {}): FakeDocker {
    let container: { id: string; ipAddress: string } | null = null
    let createContainerCalls: FakeDocker['createContainerCalls'] = []
    let putArchiveCalls: FakeDocker['putArchiveCalls'] = []
    let pullImageCalls: string[] = []

    let docker: DockerClientLike = {
      async ensureNetwork() {},
      async createVolume() {},
      async removeVolume() {},
      async inspectContainer() {
        return container ? { id: container.id, running: true, ipAddress: container.ipAddress } : null
      },
      async createContainer(name, options) {
        createContainerCalls.push({ name, options })
        container = { id: `c-${name}-${createContainerCalls.length}`, ipAddress: '172.19.0.5' }
        return { id: container.id }
      },
      async startContainer() {},
      async stopContainer() {},
      async removeContainer() {
        container = null
      },
      async putArchive(id, path, tar) {
        putArchiveCalls.push({ id, path, tar })
      },
      async pullImage(image) {
        pullImageCalls.push(image)
      },
      ...overrides,
    }

    return { docker, createContainerCalls, putArchiveCalls, pullImageCalls }
  }

  it('creates a ready space row on success, seeded with the exported data', async () => {
    let user = await createTestUser()
    let fake = fakeDocker()
    let deps: ProvisionDeps = {
      docker: fake.docker,
      exportPacuareRaw: async () => ({ columns: ['id'], rows: [['1']] }),
    }

    await provisionUserSpace(user, deps)

    let record = await db.findOne(spaces, { where: { user_id: user.id } })
    assert.ok(record)
    assert.equal(record!.status, 'ready')
    assert.equal(record!.name, spaceNameForUser(user.id, user.email))
    assert.equal(record!.notebook_url, 'http://172.19.0.5:8080')
    assert.ok(record!.notebook_token)
    assert.ok(record!.container_id)

    // The generated token is passed to the container via env and stored
    // alongside the space record so the same value authenticates it.
    assert.equal(fake.createContainerCalls.length, 1)
    assert.equal(fake.createContainerCalls[0]!.options.env?.MARIMO_TOKEN, record!.notebook_token)
    assert.equal(fake.createContainerCalls[0]!.options.volumeName, `${record!.name}-data`)

    assert.equal(fake.putArchiveCalls.length, 1)
    assert.equal(fake.putArchiveCalls[0]!.path, '/data')
    let tarText = fake.putArchiveCalls[0]!.tar.toString('utf8')
    assert.ok(tarText.includes('pacuare_raw.csv'))
    assert.ok(tarText.includes('.reseed'))
  })

  it('is idempotent: calling it again re-provisions the same space with a fresh container', async () => {
    let user = await createTestUser()
    let fake = fakeDocker()
    let deps: ProvisionDeps = { docker: fake.docker, exportPacuareRaw: async () => ({ columns: [], rows: [] }) }

    await provisionUserSpace(user, deps)
    let first = await db.findOne(spaces, { where: { user_id: user.id } })

    await provisionUserSpace(user, deps)
    let second = await db.findOne(spaces, { where: { user_id: user.id } })

    assert.equal(first!.id, second!.id)
    assert.equal(second!.status, 'ready')
    assert.equal(fake.createContainerCalls.length, 2)
    // A fresh container each time means a fresh token each time too.
    assert.notEqual(first!.notebook_token, second!.notebook_token)
  })

  it('records the failure and re-throws when a Docker call fails', async () => {
    let user = await createTestUser()
    let deps: ProvisionDeps = {
      docker: fakeDocker({
        async pullImage() {
          throw new Error('boom')
        },
      }).docker,
      exportPacuareRaw: async () => ({ columns: [], rows: [] }),
    }

    await assert.rejects(() => provisionUserSpace(user, deps))

    let record = await db.findOne(spaces, { where: { user_id: user.id } })
    assert.equal(record!.status, 'error')
    assert.equal(record!.last_error, 'boom')
  })

  it('update keeps the existing token, pulls the image, and recreates the container', async () => {
    let user = await createTestUser()
    let fake = fakeDocker()
    let deps: ProvisionDeps = { docker: fake.docker, exportPacuareRaw: async () => ({ columns: [], rows: [] }) }

    await provisionUserSpace(user, deps)
    let before = await db.findOne(spaces, { where: { user_id: user.id } })

    await updateUserSpace(user, deps)
    let after = await db.findOne(spaces, { where: { user_id: user.id } })

    assert.equal(after!.notebook_token, before!.notebook_token)
    assert.equal(after!.status, 'ready')
    assert.deepEqual(fake.pullImageCalls, [fake.pullImageCalls[0], fake.pullImageCalls[0]])
    // update doesn't re-seed data: no second putArchive beyond the initial provision.
    assert.equal(fake.putArchiveCalls.length, 1)
    assert.equal(fake.createContainerCalls.length, 2)
  })

  it('update fails clearly when the space was never provisioned', async () => {
    let user = await createTestUser()
    let deps: ProvisionDeps = { docker: fakeDocker().docker, exportPacuareRaw: async () => ({ columns: [], rows: [] }) }

    await assert.rejects(() => updateUserSpace(user, deps), /has not been set up/)
  })

  it('destroy stops and removes the container, removes the volume, and clears the record', async () => {
    let user = await createTestUser()
    let stoppedIds: string[] = []
    let removedContainerIds: string[] = []
    let removedVolumes: string[] = []
    let fake = fakeDocker({
      async stopContainer(id) {
        stoppedIds.push(id)
      },
      async removeContainer(id) {
        removedContainerIds.push(id)
      },
      async removeVolume(name) {
        removedVolumes.push(name)
      },
    })
    let deps: ProvisionDeps = { docker: fake.docker, exportPacuareRaw: async () => ({ columns: [], rows: [] }) }
    await provisionUserSpace(user, deps)
    let provisioned = await db.findOne(spaces, { where: { user_id: user.id } })

    await destroyUserSpace(user, deps)

    let record = await db.findOne(spaces, { where: { user_id: user.id } })
    assert.equal(record!.status, 'deleted')
    assert.equal(record!.notebook_url, null)
    assert.equal(record!.notebook_token, null)
    assert.equal(record!.container_id, null)
    assert.deepEqual(stoppedIds, [provisioned!.container_id])
    assert.deepEqual(removedContainerIds, [provisioned!.container_id])
    assert.deepEqual(removedVolumes, [`${spaceNameForUser(user.id, user.email)}-data`])
  })

  it('destroy is a no-op when the user never provisioned a space', async () => {
    let user = await createTestUser()
    await destroyUserSpace(user, {
      docker: fakeDocker({
        async removeVolume() {
          throw new Error('should not be called')
        },
      }).docker,
      exportPacuareRaw: async () => ({ columns: [], rows: [] }),
    })

    let record = await db.findOne(spaces, { where: { user_id: user.id } })
    assert.equal(record, null)
  })
})
