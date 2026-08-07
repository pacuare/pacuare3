import { Pool } from 'pg'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createPostgresDatabaseAdapter } from 'remix/data-table/postgres'

import { env } from '../app/data/env.ts'

let pool = new Pool({ connectionString: env.databaseUrl })
let adapter = createPostgresDatabaseAdapter(pool)
let migrations = await loadMigrations('./db/migrations')
let runner = createMigrationRunner(adapter, migrations)

let result = await runner.up()
for (let entry of result.applied) {
  console.log(`applied ${entry.id}_${entry.name}`)
}
if (result.applied.length === 0) {
  console.log('No pending migrations.')
}

await pool.end()
