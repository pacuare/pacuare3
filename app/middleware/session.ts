import { createCookie } from 'remix/cookie'
import { createFsSessionStorage } from 'remix/session-storage/fs'

import { env } from '../data/env.ts'

export const sessionCookie = createCookie('pacuare_session', {
  secrets: [env.sessionSecret],
  httpOnly: true,
  sameSite: 'Lax',
  secure: env.nodeEnv === 'production',
  maxAge: 2592000, // 30 days
  path: '/',
})

export const sessionStorage = createFsSessionStorage('./tmp/sessions')
