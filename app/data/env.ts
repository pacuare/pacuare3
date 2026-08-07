const nodeEnv = process.env.NODE_ENV ?? 'development'

function required(name: string): string {
  let value = process.env[name]
  if (value) return value
  if (nodeEnv === 'test') return `test-${name.toLowerCase()}`
  throw new Error(`${name} is required`)
}

export const env = {
  nodeEnv,
  appOrigin: process.env.APP_ORIGIN ?? 'http://localhost:44100',
  // App database: authorized users, Google identities, sprite records.
  databaseUrl: required('DATABASE_URL'),
  // Separate database holding the canonical `pacuare_raw` table sprites are seeded from.
  dataDatabaseUrl: required('DATA_DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  spritesToken: required('SPRITES_TOKEN'),
  spritesBaseUrl: process.env.SPRITES_BASE_URL ?? 'https://api.sprites.dev',
}
