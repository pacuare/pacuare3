import { Pool } from 'pg'
import { createDatabase, Database } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table/postgres'
import type { Middleware } from 'remix/router'

import { env } from './env.ts'

const pool = new Pool({ connectionString: env.databaseUrl })

export const db = createDatabase(createPostgresDatabaseAdapter(pool))

export function loadDatabase(): Middleware<{ key: typeof Database; value: typeof db }> {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}
