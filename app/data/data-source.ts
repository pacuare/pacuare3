import { Pool } from 'pg'

import { env } from './env.ts'

// Read-only connection to the main "data" database, which is intentionally
// separate from the app database above. It holds the canonical
// `pacuare_raw` table that every user's sprite gets a copy of.
const dataPool = new Pool({ connectionString: env.dataDatabaseUrl })

export interface TableExport {
  columns: string[]
  rows: unknown[][]
}

export async function exportPacuareRaw(): Promise<TableExport> {
  let result = await dataPool.query('select * from pacuare_raw')
  let columns = result.fields.map((field) => field.name)
  let rows = result.rows.map((row) => columns.map((column) => row[column]))
  return { columns, rows }
}
