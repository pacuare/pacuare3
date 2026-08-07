import * as assert from 'remix/assert'
import { describe, it, beforeEach, afterEach } from 'remix/test'

import { SpritesApiError, SpritesClient } from './client.ts'

interface RecordedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: string | undefined
}

let originalFetch: typeof fetch
let requests: RecordedRequest[]
let respond: (req: RecordedRequest) => Response

function installFetch() {
  requests = []
  originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = input instanceof URL ? input.toString() : String(input)
    let headers: Record<string, string> = {}
    for (let [key, value] of new Headers(init?.headers).entries()) {
      headers[key] = value
    }
    let req: RecordedRequest = {
      url,
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? init.body : undefined,
    }
    requests.push(req)
    return respond(req)
  }) as typeof fetch
}

function restoreFetch() {
  globalThis.fetch = originalFetch
}

describe('SpritesClient', () => {
  beforeEach(() => installFetch())
  afterEach(() => restoreFetch())

  it('creates a sprite with a bearer token and url settings', async () => {
    respond = () =>
      new Response(JSON.stringify({ id: '1', name: 'pacuare-1-a', organization: 'org', status: 'running' }), {
        status: 200,
      })

    let client = new SpritesClient('secret-token', 'https://api.sprites.test')
    let sprite = await client.createSprite('pacuare-1-a', { urlSettings: { auth: 'public' } })

    assert.equal(sprite.name, 'pacuare-1-a')
    assert.equal(requests.length, 1)
    assert.equal(requests[0]!.method, 'POST')
    assert.equal(requests[0]!.url, 'https://api.sprites.test/v1/sprites')
    assert.equal(requests[0]!.headers['authorization'], 'Bearer secret-token')
    assert.deepEqual(JSON.parse(requests[0]!.body!), {
      name: 'pacuare-1-a',
      url_settings: { auth: 'public' },
    })
  })

  it('throws SpritesApiError with the response status and body on failure', async () => {
    respond = () => new Response('sprite name already in use', { status: 409 })

    let client = new SpritesClient('token')

    await assert.rejects(
      () => client.createSprite('taken'),
      (error: unknown) => {
        assert.ok(error instanceof SpritesApiError)
        assert.equal((error as SpritesApiError).status, 409)
        assert.equal((error as SpritesApiError).body, 'sprite name already in use')
        return true
      },
    )
  })

  it('encodes the write-file path and body as raw bytes', async () => {
    respond = () => new Response(null, { status: 200 })

    let client = new SpritesClient('token', 'https://api.sprites.test')
    await client.writeFile('my-sprite', '/app/notebook.py', 'print(1)')

    let req = requests[0]!
    assert.equal(req.method, 'PUT')
    assert.ok(req.url.startsWith('https://api.sprites.test/v1/sprites/my-sprite/fs/write?'))
    assert.ok(req.url.includes('path=%2Fapp%2Fnotebook.py'))
    assert.equal(req.body, 'print(1)')
  })

  it('parses NDJSON service log events', async () => {
    respond = () =>
      new Response(
        '{"type":"started","timestamp":1}\n{"type":"exit","exit_code":0,"timestamp":2}\n',
        { status: 200 },
      )

    let client = new SpritesClient('token', 'https://api.sprites.test')
    let events = await client.createService('my-sprite', 'marimo', {
      cmd: 'marimo',
      httpPort: 8080,
    })

    assert.equal(events.length, 2)
    assert.equal(events[0]!.type, 'started')
    assert.equal(events[1]!.exit_code, 0)

    let req = requests[0]!
    assert.deepEqual(JSON.parse(req.body!), { cmd: 'marimo', http_port: 8080 })
  })

  it('treats deleteSprite 404 as success (already gone)', async () => {
    respond = () => new Response('not found', { status: 404 })

    let client = new SpritesClient('token')
    await client.deleteSprite('missing')

    assert.equal(requests.length, 1)
    assert.equal(requests[0]!.method, 'DELETE')
  })
})
