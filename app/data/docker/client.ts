// Minimal client for the Docker Engine API (https://docs.docker.com/engine/api/),
// talking to the host's daemon over its Unix socket. Covers just what
// provisioning a per-user "space" needs: a network to reach containers on,
// a persistent volume, a container built from it, files uploaded onto that
// volume before first boot, and pulling a fresh image for updates.

import * as http from 'node:http'

/** The fixed port every space's marimo server listens on inside its container. */
export const NOTEBOOK_PORT = 8080

export interface ContainerInfo {
  id: string
  running: boolean
  /** The container's address on `network`, or `null` if it isn't attached (yet). */
  ipAddress: string | null
}

export interface CreateContainerOptions {
  image: string
  volumeName: string
  /** Where the volume is mounted inside the container. Defaults to `/data`. */
  volumeMountPath?: string
  network: string
  env?: Record<string, string>
}

/** The subset of `DockerClient` that provisioning depends on -- lets tests supply a fake. */
export interface DockerClientLike {
  ensureNetwork(name: string): Promise<void>
  createVolume(name: string): Promise<void>
  removeVolume(name: string): Promise<void>
  inspectContainer(name: string, network: string): Promise<ContainerInfo | null>
  createContainer(name: string, options: CreateContainerOptions): Promise<{ id: string }>
  startContainer(id: string): Promise<void>
  stopContainer(id: string): Promise<void>
  removeContainer(id: string): Promise<void>
  putArchive(id: string, path: string, tar: Buffer): Promise<void>
  pullImage(image: string): Promise<void>
}

export class DockerApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message)
    this.name = 'DockerApiError'
  }
}

interface RawResponse {
  status: number
  body: Buffer
}

interface DockerContainerInspect {
  Id: string
  State?: { Running?: boolean }
  NetworkSettings?: { Networks?: Record<string, { IPAddress?: string } | undefined> }
}

function parseContainerInfo(data: DockerContainerInspect, network: string): ContainerInfo {
  return {
    id: data.Id,
    running: Boolean(data.State?.Running),
    ipAddress: data.NetworkSettings?.Networks?.[network]?.IPAddress || null,
  }
}

export interface DockerClientOptions {
  /** Path to the Docker daemon's Unix socket. Defaults to `/var/run/docker.sock`. */
  socketPath?: string
  /** Docker Engine API version to address. Defaults to `v1.41` (Docker 20.10+). */
  apiVersion?: string
  /** Base64-encoded `X-Registry-Auth` JSON, for pulling from a private registry. */
  registryAuth?: string
}

export class DockerClient implements DockerClientLike {
  #socketPath: string
  #apiVersion: string
  #registryAuth: string | undefined

  constructor(options: DockerClientOptions = {}) {
    this.#socketPath = options.socketPath ?? '/var/run/docker.sock'
    this.#apiVersion = options.apiVersion ?? 'v1.41'
    this.#registryAuth = options.registryAuth
  }

  #request(
    method: string,
    path: string,
    options: { headers?: Record<string, string>; body?: Buffer } = {},
  ): Promise<RawResponse> {
    return new Promise((resolve, reject) => {
      let request = http.request(
        {
          socketPath: this.#socketPath,
          path: `/${this.#apiVersion}${path}`,
          method,
          headers: options.headers,
        },
        (response) => {
          let chunks: Buffer[] = []
          response.on('data', (chunk: Buffer) => chunks.push(chunk))
          response.on('end', () => {
            resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks) })
          })
        },
      )
      request.on('error', reject)
      request.end(options.body)
    })
  }

  async #json<T>(method: string, path: string, body?: unknown): Promise<T> {
    let headers: Record<string, string> = {}
    let bodyBuffer: Buffer | undefined
    if (body !== undefined) {
      bodyBuffer = Buffer.from(JSON.stringify(body))
      headers['Content-Type'] = 'application/json'
    }
    let response = await this.#request(method, path, { headers, body: bodyBuffer })
    if (response.status >= 400) {
      throw new DockerApiError(
        `Docker API ${method} ${path} failed with ${response.status}`,
        response.status,
        response.body.toString('utf8'),
      )
    }
    if (response.body.length === 0) return undefined as T
    return JSON.parse(response.body.toString('utf8')) as T
  }

  async ensureNetwork(name: string): Promise<void> {
    let existing = await this.#request('GET', `/networks/${encodeURIComponent(name)}`)
    if (existing.status === 200) return
    await this.#json('POST', '/networks/create', { Name: name, Driver: 'bridge' })
  }

  async createVolume(name: string): Promise<void> {
    // Idempotent: creating a volume with a name that already exists just
    // returns the existing volume instead of erroring.
    await this.#json('POST', '/volumes/create', { Name: name })
  }

  async removeVolume(name: string): Promise<void> {
    let response = await this.#request('DELETE', `/volumes/${encodeURIComponent(name)}?force=true`)
    if (response.status >= 400 && response.status !== 404) {
      throw new DockerApiError('Failed to remove volume', response.status, response.body.toString('utf8'))
    }
  }

  async inspectContainer(name: string, network: string): Promise<ContainerInfo | null> {
    let response = await this.#request('GET', `/containers/${encodeURIComponent(name)}/json`)
    if (response.status === 404) return null
    if (response.status >= 400) {
      throw new DockerApiError(
        'Failed to inspect container',
        response.status,
        response.body.toString('utf8'),
      )
    }
    return parseContainerInfo(
      JSON.parse(response.body.toString('utf8')) as DockerContainerInspect,
      network,
    )
  }

  async createContainer(name: string, options: CreateContainerOptions): Promise<{ id: string }> {
    let env = Object.entries(options.env ?? {}).map(([key, value]) => `${key}=${value}`)
    let mountPath = options.volumeMountPath ?? '/data'
    let data = await this.#json<{ Id: string }>(
      'POST',
      `/containers/create?name=${encodeURIComponent(name)}`,
      {
        Image: options.image,
        Env: env,
        ExposedPorts: { [`${NOTEBOOK_PORT}/tcp`]: {} },
        HostConfig: {
          Binds: [`${options.volumeName}:${mountPath}`],
          RestartPolicy: { Name: 'unless-stopped' },
        },
        NetworkingConfig: {
          EndpointsConfig: { [options.network]: {} },
        },
      },
    )
    return { id: data.Id }
  }

  async startContainer(id: string): Promise<void> {
    let response = await this.#request('POST', `/containers/${encodeURIComponent(id)}/start`)
    // 304 = already started; treat as success rather than an error.
    if (response.status >= 400 && response.status !== 304) {
      throw new DockerApiError(
        'Failed to start container',
        response.status,
        response.body.toString('utf8'),
      )
    }
  }

  async stopContainer(id: string): Promise<void> {
    let response = await this.#request('POST', `/containers/${encodeURIComponent(id)}/stop?t=10`)
    // 304 = already stopped, 404 = already gone; both are fine here.
    if (response.status >= 400 && response.status !== 304 && response.status !== 404) {
      throw new DockerApiError(
        'Failed to stop container',
        response.status,
        response.body.toString('utf8'),
      )
    }
  }

  async removeContainer(id: string): Promise<void> {
    let response = await this.#request('DELETE', `/containers/${encodeURIComponent(id)}?force=true`)
    if (response.status >= 400 && response.status !== 404) {
      throw new DockerApiError(
        'Failed to remove container',
        response.status,
        response.body.toString('utf8'),
      )
    }
  }

  async putArchive(id: string, path: string, tar: Buffer): Promise<void> {
    let response = await this.#request(
      'PUT',
      `/containers/${encodeURIComponent(id)}/archive?path=${encodeURIComponent(path)}`,
      { headers: { 'Content-Type': 'application/x-tar' }, body: tar },
    )
    if (response.status >= 400) {
      throw new DockerApiError(
        'Failed to upload files to container',
        response.status,
        response.body.toString('utf8'),
      )
    }
  }

  async pullImage(image: string): Promise<void> {
    let headers: Record<string, string> = {}
    if (this.#registryAuth) headers['X-Registry-Auth'] = this.#registryAuth

    let response = await this.#request(
      'POST',
      `/images/create?fromImage=${encodeURIComponent(image)}`,
      { headers },
    )
    if (response.status >= 400) {
      throw new DockerApiError('Failed to pull image', response.status, response.body.toString('utf8'))
    }

    // The response is a stream of NDJSON progress events; a failure surfaces
    // as an `error` field in one of those events rather than a bad status.
    let text = response.body.toString('utf8')
    for (let line of text.split('\n')) {
      if (!line.trim()) continue
      let event = JSON.parse(line) as { error?: string }
      if (event.error) {
        throw new DockerApiError(`Failed to pull image ${image}: ${event.error}`, response.status, text)
      }
    }
  }
}
