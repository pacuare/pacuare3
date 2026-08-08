import { randomBytes } from 'node:crypto'

import { toCsv } from '../../utils/csv.ts'
import { db } from '../db.ts'
import { exportPacuareRaw, type TableExport } from '../data-source.ts'
import { env } from '../env.ts'
import { userSprites, type UserSprite } from '../schema.ts'
import { SpritesApiError, SpritesClient, type SpritesClientLike } from './client.ts'
import { buildBootstrapScript, buildNotebook } from './templates.ts'

const defaultSprites = new SpritesClient(env.spritesToken, env.spritesBaseUrl)

// Only what provisioning needs from a user -- deliberately not the full
// `User` row, so this stays decoupled from the auth identity shape.
export interface SpriteOwner {
  id: number
  email: string
}

/** Overridable for tests; production code never needs to pass this. */
export interface ProvisionDeps {
  sprites: SpritesClientLike
  exportPacuareRaw: () => Promise<TableExport>
}

const defaultDeps: ProvisionDeps = {
  sprites: defaultSprites,
  exportPacuareRaw,
}

/** Equivalent to `openssl rand -hex 64`: 64 random bytes, hex-encoded. */
export function generateNotebookToken(): string {
  return randomBytes(64).toString('hex')
}

function marimoService(token: string) {
  return {
    cmd: 'marimo',
    args: [
      'edit',
      '--host',
      '0.0.0.0',
      '-p',
      '8080',
      '--token-password',
      token,
      '/app/notebook.py',
    ],
    httpPort: 8080,
    needs: ['setup'],
    dir: '/app',
  }
}

export function spriteNameForUser(id: number, email: string): string {
  let slug = email
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  // The numeric id (unique per user) guards against two different emails
  // sanitizing down to the same slug and colliding on one sprite.
  return `pacuare-${id}-${slug}`
}

async function findOrCreateRecord(user: SpriteOwner, name: string): Promise<UserSprite> {
  let existing = await db.findOne(userSprites, { where: { user_id: user.id } })
  if (existing) {
    return db.update(userSprites, existing.id, {
      status: 'provisioning',
      last_error: null,
      updated_at: new Date(),
    })
  }
  return db.create(
    userSprites,
    { user_id: user.id, name, status: 'provisioning' },
    { returnRow: true },
  )
}

/**
 * Creates (or re-seeds) the sprite for a user: a sandbox with its own copy
 * of `pacuare_raw` and a marimo notebook host on port 8080. Idempotent, so
 * this also powers the "reset" action -- calling it again re-copies the
 * data and restarts the notebook service.
 */
export async function provisionUserSprite(
  user: SpriteOwner,
  deps: ProvisionDeps = defaultDeps,
): Promise<void> {
  let { sprites, exportPacuareRaw: exportData } = deps
  let name = spriteNameForUser(user.id, user.email)
  let record = await findOrCreateRecord(user, name)

  try {
    try {
      await sprites.createSprite(name, { urlSettings: { auth: 'public' } })
    } catch (error) {
      if (error instanceof SpritesApiError && (error.status === 409 || error.status === 400)) {
        await sprites.updateUrlSettings(name, { auth: 'public' })
      } else {
        throw error
      }
    }

    let { columns, rows } = await exportData()
    let csv = toCsv(columns, rows)

    await sprites.writeFile(name, '/app/data/pacuare_raw.csv', csv)
    await sprites.writeFile(name, '/app/bootstrap.py', buildBootstrapScript())
    await sprites.writeFile(name, '/app/notebook.py', buildNotebook())

    // "setup" is a one-shot service; "marimo" declares it as a dependency so
    // it only starts once the data has finished loading.
    await sprites.createService(name, 'setup', {
      cmd: 'bash',
      args: [
        '-lc',
        'pip install --quiet --disable-pip-version-check marimo pandas && python3 /app/bootstrap.py',
      ],
      dir: '/app',
    })
    let notebookToken = generateNotebookToken()
    await sprites.createService(name, 'marimo', marimoService(notebookToken))

    let sprite = await sprites.getSprite(name)

    await db.update(userSprites, record.id, {
      status: 'ready',
      notebook_url: sprite.url ?? null,
      notebook_token: notebookToken,
      last_error: null,
      updated_at: new Date(),
    })
  } catch (error) {
    await db.update(userSprites, record.id, {
      status: 'error',
      last_error: error instanceof Error ? error.message : String(error),
      updated_at: new Date(),
    })
    throw error
  }
}

export async function destroyUserSprite(
  user: SpriteOwner,
  deps: ProvisionDeps = defaultDeps,
): Promise<void> {
  let record = await db.findOne(userSprites, { where: { user_id: user.id } })
  if (!record) return

  await deps.sprites.deleteSprite(record.name)
  await db.update(userSprites, record.id, {
    status: 'deleted',
    notebook_url: null,
    notebook_token: null,
    updated_at: new Date(),
  })
}
