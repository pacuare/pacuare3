// Minimal client for the Sprites.dev REST API (https://docs.sprites.dev/api/).
// Covers just what provisioning a per-user marimo sandbox needs: create/get/
// delete a sprite, write files to it, and create long-running or dependent
// one-shot services on it.

export interface SpriteUrlSettings {
  auth?: 'public' | 'sprite'
  private_access?: string
}

export interface SpriteInfo {
  id: string
  name: string
  organization: string
  status: string
  url?: string
  url_settings?: SpriteUrlSettings
  created_at?: string
  updated_at?: string
}

export interface ServiceLogEvent {
  type: string
  data?: string
  exit_code?: number
  timestamp?: number
}

export interface CreateServiceOptions {
  cmd: string
  args?: string[]
  /** Names of other services on this sprite that must complete first. */
  needs?: string[]
  /** Declaring this makes the service long-running and exposes it on the sprite's URL. */
  httpPort?: number
  env?: Record<string, string>
  dir?: string
}

/** The subset of `SpritesClient` that provisioning depends on -- lets tests supply a fake. */
export interface SpritesClientLike {
  createSprite(name: string, options?: { urlSettings?: SpriteUrlSettings; labels?: string[] }): Promise<SpriteInfo>
  getSprite(name: string): Promise<SpriteInfo>
  deleteSprite(name: string): Promise<void>
  updateUrlSettings(name: string, settings: SpriteUrlSettings): Promise<SpriteInfo>
  writeFile(name: string, path: string, content: string): Promise<void>
  createService(
    name: string,
    serviceName: string,
    options: CreateServiceOptions,
  ): Promise<ServiceLogEvent[]>
}

export class SpritesApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message)
    this.name = 'SpritesApiError'
  }
}

export class SpritesClient {
  #token: string
  #baseUrl: string

  constructor(token: string, baseUrl = 'https://api.sprites.dev') {
    this.#token = token
    this.#baseUrl = baseUrl.replace(/\/$/, '')
  }

  #headers(extra?: Record<string, string>): Record<string, string> {
    return { Authorization: `Bearer ${this.#token}`, ...extra }
  }

  #spriteUrl(name: string): string {
    return `${this.#baseUrl}/v1/sprites/${encodeURIComponent(name)}`
  }

  async #json<T>(url: string, init: RequestInit): Promise<T> {
    let response = await fetch(url, init)
    if (!response.ok) {
      let body = await response.text().catch(() => '')
      throw new SpritesApiError(
        `Sprites API ${init.method ?? 'GET'} ${url} failed with ${response.status}`,
        response.status,
        body,
      )
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  async #ndjson(url: string, init: RequestInit): Promise<ServiceLogEvent[]> {
    let response = await fetch(url, init)
    let text = await response.text()
    if (!response.ok) {
      throw new SpritesApiError(
        `Sprites API ${init.method ?? 'GET'} ${url} failed with ${response.status}`,
        response.status,
        text,
      )
    }
    return text
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as ServiceLogEvent)
  }

  async createSprite(
    name: string,
    options: { urlSettings?: SpriteUrlSettings; labels?: string[] } = {},
  ): Promise<SpriteInfo> {
    let body: Record<string, unknown> = { name }
    if (options.urlSettings) body.url_settings = options.urlSettings
    if (options.labels) body.labels = options.labels

    return this.#json(`${this.#baseUrl}/v1/sprites`, {
      method: 'POST',
      headers: this.#headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
  }

  async getSprite(name: string): Promise<SpriteInfo> {
    return this.#json(this.#spriteUrl(name), { headers: this.#headers() })
  }

  async deleteSprite(name: string): Promise<void> {
    let response = await fetch(this.#spriteUrl(name), {
      method: 'DELETE',
      headers: this.#headers(),
    })
    if (!response.ok && response.status !== 204 && response.status !== 404) {
      let body = await response.text().catch(() => '')
      throw new SpritesApiError('Failed to delete sprite', response.status, body)
    }
  }

  async updateUrlSettings(name: string, settings: SpriteUrlSettings): Promise<SpriteInfo> {
    return this.#json(this.#spriteUrl(name), {
      method: 'PUT',
      headers: this.#headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ url_settings: settings }),
    })
  }

  async writeFile(name: string, path: string, content: string): Promise<void> {
    let url = new URL(`${this.#spriteUrl(name)}/fs/write`)
    url.searchParams.set('path', path)
    url.searchParams.set('mkdirParents', 'true')

    let response = await fetch(url, {
      method: 'PUT',
      headers: this.#headers({ 'Content-Type': 'application/octet-stream' }),
      body: content,
    })
    if (!response.ok) {
      let body = await response.text().catch(() => '')
      throw new SpritesApiError('Failed to write sprite file', response.status, body)
    }
  }

  /** Creates or updates a service. Long-running when `httpPort` is set, one-shot otherwise. */
  async createService(
    name: string,
    serviceName: string,
    options: CreateServiceOptions,
  ): Promise<ServiceLogEvent[]> {
    let body: Record<string, unknown> = { cmd: options.cmd }
    if (options.args) body.args = options.args
    if (options.needs) body.needs = options.needs
    if (options.httpPort) body.http_port = options.httpPort
    if (options.env) body.env = options.env
    if (options.dir) body.dir = options.dir

    return this.#ndjson(`${this.#spriteUrl(name)}/services/${encodeURIComponent(serviceName)}`, {
      method: 'PUT',
      headers: this.#headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
  }

  async deleteService(name: string, serviceName: string): Promise<void> {
    let response = await fetch(
      `${this.#spriteUrl(name)}/services/${encodeURIComponent(serviceName)}`,
      { method: 'DELETE', headers: this.#headers() },
    )
    if (!response.ok && response.status !== 204 && response.status !== 404) {
      let body = await response.text().catch(() => '')
      throw new SpritesApiError('Failed to delete service', response.status, body)
    }
  }
}
