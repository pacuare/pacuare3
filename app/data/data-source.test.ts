import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { hasTestDataDatabase } from '../../test/helpers.ts'
import { exportPacuareRaw } from './data-source.ts'

describe('exportPacuareRaw', () => {
  if (!hasTestDataDatabase) {
    it.skip('requires DATA_DATABASE_URL', () => {})
    return
  }

  it('reads columns and rows from the data database', async () => {
    let { columns, rows } = await exportPacuareRaw()

    assert.ok(columns.includes('id'))
    assert.ok(columns.includes('turtle_species'))
    assert.ok(rows.length >= 2)

    let idIndex = columns.indexOf('id')
    let ids = rows.map((row) => row[idIndex])
    assert.ok(ids.includes('1'))
    assert.ok(ids.includes('2'))
  })
})
