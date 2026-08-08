import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { buildTar } from './tar.ts'

/** Extracts a built tar with the real `tar` binary and returns the resulting directory. */
function extract(archive: Buffer): string {
  let dir = mkdtempSync(join(tmpdir(), 'pacuare-tar-test-'))
  let archivePath = join(dir, 'archive.tar')
  writeFileSync(archivePath, archive)
  execFileSync('tar', ['-xf', archivePath, '-C', dir])
  return dir
}

describe('buildTar', () => {
  it('round-trips a single small file through the real tar binary', () => {
    let dir = extract(buildTar([{ path: 'notebook.py', content: 'print(1)\n' }]))
    assert.equal(readFileSync(join(dir, 'notebook.py'), 'utf8'), 'print(1)\n')
    rmSync(dir, { recursive: true, force: true })
  })

  it('round-trips multiple files, including an empty one', () => {
    let entries = [
      { path: 'pacuare_raw.csv', content: 'a,b\n1,2\n' },
      { path: '.reseed', content: '' },
    ]
    let dir = extract(buildTar(entries))

    assert.equal(readFileSync(join(dir, 'pacuare_raw.csv'), 'utf8'), 'a,b\n1,2\n')
    assert.equal(readFileSync(join(dir, '.reseed'), 'utf8'), '')
    rmSync(dir, { recursive: true, force: true })
  })

  it('preserves multi-byte UTF-8 content byte-for-byte', () => {
    let content = 'π ≈ 3.14159, 東京\n'
    let dir = extract(buildTar([{ path: 'notes.txt', content }]))
    assert.equal(readFileSync(join(dir, 'notes.txt'), 'utf8'), content)
    rmSync(dir, { recursive: true, force: true })
  })
})
