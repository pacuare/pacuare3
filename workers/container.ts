import { Container, getContainer } from '@cloudflare/containers'
import type { DurableObject } from 'cloudflare:workers'

interface Env {
  PACUARE_CONTAINER: DurableObjectNamespace<PacuareContainer>
  APP_ORIGIN: string
  GOOGLE_CLIENT_ID: string
  SPRITES_BASE_URL: string
  DATABASE_URL: string
  DATA_DATABASE_URL: string
  SESSION_SECRET: string
  GOOGLE_CLIENT_SECRET: string
  SPRITES_TOKEN: string
}

// One container instance serves the whole app -- this isn't a per-user or
// per-session sandbox, just the ordinary Postgres-backed web app running in
// a container instead of the Workers isolate (see app/assets.ts and
// app/data/db.ts for why it can't run as a plain Worker).
export class PacuareContainer extends Container<Env> {
  defaultPort = 8080

  constructor(ctx: DurableObject['ctx'], env: Env) {
    super(ctx, env)
    this.envVars = {
      NODE_ENV: 'production',
      PORT: String(this.defaultPort),
      APP_ORIGIN: env.APP_ORIGIN,
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      SPRITES_BASE_URL: env.SPRITES_BASE_URL,
      DATABASE_URL: env.DATABASE_URL,
      DATA_DATABASE_URL: env.DATA_DATABASE_URL,
      SESSION_SECRET: env.SESSION_SECRET,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
      SPRITES_TOKEN: env.SPRITES_TOKEN,
    }
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return getContainer(env.PACUARE_CONTAINER).fetch(request)
  },
}
