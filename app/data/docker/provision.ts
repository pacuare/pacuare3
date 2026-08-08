import { randomBytes } from 'node:crypto'

import { toCsv } from '../../utils/csv.ts'
import { db } from '../db.ts'
import { exportPacuareRaw, type TableExport } from '../data-source.ts'
import { env } from '../env.ts'
import { spaces, type Space } from '../schema.ts'
import { DockerClient, NOTEBOOK_PORT, type DockerClientLike } from './client.ts'
import { buildTar } from './tar.ts'

/** Where each space's volume is mounted inside its container. */
const DATA_PATH = '/data'

const defaultDocker = new DockerClient({
  socketPath: env.dockerSocketPath,
  apiVersion: env.dockerApiVersion,
  registryAuth: env.dockerRegistryAuth,
})

// Only what provisioning needs from a user -- deliberately not the full
// `User` row, so this stays decoupled from the auth identity shape.
export interface SpaceOwner {
  id: number
  email: string
}

/** Overridable for tests; production code never needs to pass this. */
export interface ProvisionDeps {
  docker: DockerClientLike
  exportPacuareRaw: () => Promise<TableExport>
}

const defaultDeps: ProvisionDeps = {
  docker: defaultDocker,
  exportPacuareRaw,
}

/** Equivalent to `openssl rand -hex 64`: 64 random bytes, hex-encoded. */
export function generateNotebookToken(): string {
  return randomBytes(64).toString('hex')
}

export function spaceNameForUser(id: number, email: string): string {
  let slug = email
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  // The numeric id (unique per user) guards against two different emails
  // sanitizing down to the same slug and colliding on one space.
  return `pacuare-${id}-${slug}`
}

function volumeNameFor(spaceName: string): string {
  return `${spaceName}-data`
}

async function findOrCreateRecord(user: SpaceOwner, name: string): Promise<Space> {
  let existing = await db.findOne(spaces, { where: { user_id: user.id } })
  if (existing) {
    return db.update(spaces, existing.id, {
      status: 'provisioning',
      last_error: null,
      updated_at: new Date(),
    })
  }
  return db.create(spaces, { user_id: user.id, name, status: 'provisioning' }, { returnRow: true })
}

/** Removes any existing container by this name so a fresh one can take its place. Never touches the volume. */
async function clearContainer(docker: DockerClientLike, name: string): Promise<void> {
  let existing = await docker.inspectContainer(name, env.dockerNetwork)
  if (!existing) return
  await docker.stopContainer(existing.id)
  await docker.removeContainer(existing.id)
}

/** Creates and starts a space's container, optionally seeding its volume with a fresh `pacuare_raw` export first. */
async function createAndStart(
  docker: DockerClientLike,
  name: string,
  token: string,
  seedCsv?: string,
): Promise<{ id: string; url: string }> {
  let { id } = await docker.createContainer(name, {
    image: env.notebookImage,
    volumeName: volumeNameFor(name),
    volumeMountPath: DATA_PATH,
    network: env.dockerNetwork,
    env: { MARIMO_TOKEN: token },
  })

  if (seedCsv !== undefined) {
    // The `.reseed` marker tells the container's entrypoint to rebuild
    // `pacuare.db` from this CSV even though one may already exist on the
    // volume from a previous container -- notebook.py is left alone either
    // way, since it isn't part of this archive.
    await docker.putArchive(
      id,
      DATA_PATH,
      buildTar([
        { path: 'pacuare_raw.csv', content: seedCsv },
        { path: '.reseed', content: '' },
      ]),
    )
  }

  await docker.startContainer(id)
  let info = await docker.inspectContainer(id, env.dockerNetwork)
  if (!info?.ipAddress) {
    throw new Error(`Space container for ${name} has no address on ${env.dockerNetwork}`)
  }
  return { id, url: `http://${info.ipAddress}:${NOTEBOOK_PORT}` }
}

/**
 * Creates (or fully recreates) the space for a user: a container running
 * marimo, backed by a volume seeded with a fresh copy of `pacuare_raw`.
 * Idempotent, so this also powers the "Reset" action -- calling it again
 * gives the space a fresh container and re-seeds the data, but leaves any
 * notebook code already on the volume alone.
 */
export async function provisionUserSpace(
  user: SpaceOwner,
  deps: ProvisionDeps = defaultDeps,
): Promise<void> {
  let { docker, exportPacuareRaw: exportData } = deps
  let name = spaceNameForUser(user.id, user.email)
  let record = await findOrCreateRecord(user, name)

  try {
    await docker.ensureNetwork(env.dockerNetwork)
    await docker.createVolume(volumeNameFor(name))
    await docker.pullImage(env.notebookImage)
    await clearContainer(docker, name)

    let { columns, rows } = await exportData()
    let csv = toCsv(columns, rows)
    let notebookToken = generateNotebookToken()

    let { id, url } = await createAndStart(docker, name, notebookToken, csv)

    await db.update(spaces, record.id, {
      status: 'ready',
      container_id: id,
      notebook_url: url,
      notebook_token: notebookToken,
      last_error: null,
      updated_at: new Date(),
    })
  } catch (error) {
    await db.update(spaces, record.id, {
      status: 'error',
      last_error: error instanceof Error ? error.message : String(error),
      updated_at: new Date(),
    })
    throw error
  }
}

/**
 * Re-pulls the space's image and recreates its container from it, keeping
 * the same volume, token, and data -- what the settings page's "Update"
 * button calls to pick up a newer marimo/system without disturbing the
 * user's notebook or database.
 */
export async function updateUserSpace(
  user: SpaceOwner,
  deps: ProvisionDeps = defaultDeps,
): Promise<void> {
  let { docker } = deps
  let name = spaceNameForUser(user.id, user.email)
  let record = await db.findOne(spaces, { where: { user_id: user.id } })
  if (!record || !record.notebook_token) {
    throw new Error('This space has not been set up yet.')
  }

  try {
    await docker.pullImage(env.notebookImage)
    await clearContainer(docker, name)

    let { id, url } = await createAndStart(docker, name, record.notebook_token)

    await db.update(spaces, record.id, {
      status: 'ready',
      container_id: id,
      notebook_url: url,
      last_error: null,
      updated_at: new Date(),
    })
  } catch (error) {
    await db.update(spaces, record.id, {
      status: 'error',
      last_error: error instanceof Error ? error.message : String(error),
      updated_at: new Date(),
    })
    throw error
  }
}

export async function destroyUserSpace(
  user: SpaceOwner,
  deps: ProvisionDeps = defaultDeps,
): Promise<void> {
  let record = await db.findOne(spaces, { where: { user_id: user.id } })
  if (!record) return

  let name = spaceNameForUser(user.id, user.email)
  await clearContainer(deps.docker, name)
  await deps.docker.removeVolume(volumeNameFor(name))

  await db.update(spaces, record.id, {
    status: 'deleted',
    container_id: null,
    notebook_url: null,
    notebook_token: null,
    updated_at: new Date(),
  })
}
