import { mkdtempSync, rmSync } from 'node:fs'
import * as http from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as assert from 'remix/assert'
import { afterEach, beforeEach, describe, it } from 'remix/test'

import { DockerApiError, DockerClient } from './client.ts'

interface RecordedRequest {
  method: string
  url: string
  headers: http.IncomingHttpHeaders
  body: Buffer
}

interface FakeResponse {
  status: number
  body?: string
}

let server: http.Server
let socketDir: string
let socketPath: string
let requests: RecordedRequest[]
let respond: (req: RecordedRequest) => FakeResponse

function startServer(): Promise<void> {
  requests = []
  socketDir = mkdtempSync(join(tmpdir(), 'pacuare-docker-test-'))
  socketPath = join(socketDir, 'docker.sock')

  server = http.createServer((req, res) => {
    let chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      let recorded: RecordedRequest = {
        method: req.method ?? 'GET',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks),
      }
      requests.push(recorded)
      let result = respond(recorded)
      res.writeHead(result.status, { 'Content-Type': 'application/json' })
      res.end(result.body ?? '')
    })
  })

  return new Promise((resolve) => server.listen(socketPath, () => resolve()))
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      rmSync(socketDir, { recursive: true, force: true })
      resolve()
    })
  })
}

describe('DockerClient', () => {
  beforeEach(() => startServer())
  afterEach(() => stopServer())

  it('creates a network only when one by that name does not already exist', async () => {
    respond = (req) =>
      req.method === 'GET' ? { status: 404 } : { status: 201, body: JSON.stringify({ Id: 'net1' }) }

    let client = new DockerClient({ socketPath })
    await client.ensureNetwork('pacuare-spaces')

    assert.equal(requests.length, 2)
    assert.equal(requests[0]!.method, 'GET')
    assert.ok(requests[0]!.url.includes('/networks/pacuare-spaces'))
    assert.equal(requests[1]!.method, 'POST')
    assert.deepEqual(JSON.parse(requests[1]!.body.toString()), {
      Name: 'pacuare-spaces',
      Driver: 'bridge',
    })
  })

  it('skips creating a network that already exists', async () => {
    respond = () => ({ status: 200, body: JSON.stringify({ Id: 'net1' }) })

    let client = new DockerClient({ socketPath })
    await client.ensureNetwork('pacuare-spaces')

    assert.equal(requests.length, 1)
  })

  it('creates a volume by name', async () => {
    respond = () => ({ status: 201, body: JSON.stringify({ Name: 'v1' }) })

    let client = new DockerClient({ socketPath })
    await client.createVolume('v1')

    assert.equal(requests[0]!.method, 'POST')
    assert.equal(requests[0]!.url, '/v1.41/volumes/create')
    assert.deepEqual(JSON.parse(requests[0]!.body.toString()), { Name: 'v1' })
  })

  it('treats a 404 on removeVolume as success (already gone)', async () => {
    respond = () => ({ status: 404 })

    let client = new DockerClient({ socketPath })
    await client.removeVolume('missing')
  })

  it('returns null when inspecting a container that does not exist', async () => {
    respond = () => ({ status: 404 })

    let client = new DockerClient({ socketPath })
    assert.equal(await client.inspectContainer('missing', 'net'), null)
  })

  it('parses the running state and the ip on the requested network', async () => {
    respond = () => ({
      status: 200,
      body: JSON.stringify({
        Id: 'c1',
        State: { Running: true },
        NetworkSettings: { Networks: { 'pacuare-spaces': { IPAddress: '172.19.0.5' } } },
      }),
    })

    let client = new DockerClient({ socketPath })
    let info = await client.inspectContainer('c1', 'pacuare-spaces')

    assert.deepEqual(info, { id: 'c1', running: true, ipAddress: '172.19.0.5' })
  })

  it('creates a container with the volume bind, network, and env vars', async () => {
    respond = () => ({ status: 201, body: JSON.stringify({ Id: 'c1' }) })

    let client = new DockerClient({ socketPath })
    let { id } = await client.createContainer('space-1', {
      image: 'pacuare-notebook:latest',
      volumeName: 'space-1-data',
      network: 'pacuare-spaces',
      env: { MARIMO_TOKEN: 'secret' },
    })

    assert.equal(id, 'c1')
    assert.ok(requests[0]!.url.startsWith('/v1.41/containers/create?name=space-1'))
    let body = JSON.parse(requests[0]!.body.toString())
    assert.equal(body.Image, 'pacuare-notebook:latest')
    assert.deepEqual(body.Env, ['MARIMO_TOKEN=secret'])
    assert.deepEqual(body.HostConfig.Binds, ['space-1-data:/data'])
    assert.ok('pacuare-spaces' in body.NetworkingConfig.EndpointsConfig)
    assert.ok('8080/tcp' in body.ExposedPorts)
  })

  it('treats 304 as success when starting or stopping', async () => {
    respond = () => ({ status: 304 })

    let client = new DockerClient({ socketPath })
    await client.startContainer('c1')
    await client.stopContainer('c1')
  })

  it('throws DockerApiError with the status and body on failure', async () => {
    respond = () => ({ status: 500, body: 'boom' })

    let client = new DockerClient({ socketPath })
    await assert.rejects(
      () => client.startContainer('c1'),
      (error: unknown) => {
        assert.ok(error instanceof DockerApiError)
        assert.equal((error as DockerApiError).status, 500)
        assert.equal((error as DockerApiError).body, 'boom')
        return true
      },
    )
  })

  it('uploads a tar archive to the given path with the right content type', async () => {
    respond = () => ({ status: 200 })

    let client = new DockerClient({ socketPath })
    await client.putArchive('c1', '/data', Buffer.from('fake-tar'))

    assert.equal(requests[0]!.method, 'PUT')
    assert.ok(requests[0]!.url.startsWith('/v1.41/containers/c1/archive?path=%2Fdata'))
    assert.equal(requests[0]!.headers['content-type'], 'application/x-tar')
    assert.equal(requests[0]!.body.toString(), 'fake-tar')
  })

  it('pulls an image and resolves once the stream ends without an error event', async () => {
    respond = () => ({
      status: 200,
      body: '{"status":"Pulling from library/pacuare-notebook"}\n{"status":"Downloaded"}\n',
    })

    let client = new DockerClient({ socketPath })
    await client.pullImage('pacuare-notebook:latest')

    assert.ok(requests[0]!.url.includes('fromImage=pacuare-notebook%3Alatest'))
  })

  it('rejects when the pull stream reports an error event', async () => {
    respond = () => ({ status: 200, body: '{"error":"manifest unknown"}\n' })

    let client = new DockerClient({ socketPath })
    await assert.rejects(
      () => client.pullImage('missing:latest'),
      (error: unknown) => {
        assert.ok(error instanceof DockerApiError)
        assert.match((error as DockerApiError).message, /manifest unknown/)
        return true
      },
    )
  })

  it('sends X-Registry-Auth when configured', async () => {
    respond = () => ({ status: 200, body: '' })

    let client = new DockerClient({ socketPath, registryAuth: 'base64stuff' })
    await client.pullImage('private/image:latest')

    assert.equal(requests[0]!.headers['x-registry-auth'], 'base64stuff')
  })
})
