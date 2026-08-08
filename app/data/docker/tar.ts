// A minimal USTAR tar builder -- just enough to upload a handful of small
// text files to a container via the Docker `PUT /containers/{id}/archive`
// endpoint, which expects a tar stream. No external dependency: the format
// is small and fully specified (POSIX.1-1988 ustar).

const BLOCK_SIZE = 512

export interface TarEntry {
  path: string
  content: string
}

function octalField(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0'
}

function buildHeader(name: string, size: number, mtimeSeconds: number): Buffer {
  if (Buffer.byteLength(name, 'utf8') > 100) {
    throw new Error(`tar entry name too long for ustar: ${name}`)
  }

  let header = Buffer.alloc(BLOCK_SIZE)
  header.write(name, 0, 100, 'utf8')
  header.write(octalField(0o644, 8), 100, 8, 'ascii') // mode
  header.write(octalField(0, 8), 108, 8, 'ascii') // uid
  header.write(octalField(0, 8), 116, 8, 'ascii') // gid
  header.write(octalField(size, 12), 124, 12, 'ascii') // size
  header.write(octalField(mtimeSeconds, 12), 136, 12, 'ascii') // mtime
  header.fill(0x20, 148, 156) // chksum: eight ASCII spaces while computing
  header.write('0', 156, 1, 'ascii') // typeflag: regular file
  header.write('ustar\0', 257, 6, 'ascii') // magic
  header.write('00', 263, 2, 'ascii') // ustar version

  let checksum = 0
  for (let byte of header) checksum += byte
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')

  return header
}

function padToBlock(buf: Buffer): Buffer {
  let remainder = buf.length % BLOCK_SIZE
  if (remainder === 0) return buf
  return Buffer.concat([buf, Buffer.alloc(BLOCK_SIZE - remainder)])
}

/** Builds a tar archive of plain text files, suitable for the Docker archive-upload endpoint. */
export function buildTar(entries: TarEntry[]): Buffer {
  let mtimeSeconds = Math.floor(Date.now() / 1000)
  let parts: Buffer[] = []

  for (let entry of entries) {
    let content = Buffer.from(entry.content, 'utf8')
    parts.push(buildHeader(entry.path, content.length, mtimeSeconds))
    parts.push(padToBlock(content))
  }

  parts.push(Buffer.alloc(BLOCK_SIZE * 2)) // two zero-filled blocks mark the end of the archive
  return Buffer.concat(parts)
}
