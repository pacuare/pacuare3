import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { toCsv } from './csv.ts'

describe('toCsv', () => {
  it('encodes a header row plus data rows', () => {
    let csv = toCsv(['id', 'name'], [
      [1, 'Alice'],
      [2, 'Bob'],
    ])

    assert.equal(csv, 'id,name\n1,Alice\n2,Bob\n')
  })

  it('quotes fields containing commas, quotes, or newlines', () => {
    let csv = toCsv(['note'], [['has, a comma'], ['has "quotes"'], ['has\na newline']])

    assert.equal(csv, 'note\n"has, a comma"\n"has ""quotes"""\n"has\na newline"\n')
  })

  it('renders null and undefined as empty fields', () => {
    let csv = toCsv(['a', 'b'], [[null, undefined]])

    assert.equal(csv, 'a,b\n,\n')
  })
})
