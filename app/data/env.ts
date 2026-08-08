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
  // App database: authorized users, Google identities, space records.
  databaseUrl: required('DATABASE_URL'),
  // Separate database holding the canonical `pacuare_raw` table spaces are seeded from.
  dataDatabaseUrl: required('DATA_DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  // Docker daemon this app provisions per-user spaces against. Defaults
  // assume the daemon's socket is reachable at the usual path (bind-mount it
  // into this app's own container if running containerized) and that this
  // app can route to containers on `dockerNetwork` -- either because it runs
  // directly on the host, or because its own container is also attached to
  // that network.
  dockerSocketPath: process.env.DOCKER_SOCKET_PATH ?? '/var/run/docker.sock',
  dockerApiVersion: process.env.DOCKER_API_VERSION ?? 'v1.41',
  dockerNetwork: process.env.DOCKER_NETWORK ?? 'pacuare-spaces',
  // Image every space's container runs, built from ./notebook. Re-pulled by
  // the settings page's "Update" action.
  notebookImage: process.env.NOTEBOOK_IMAGE ?? 'pacuare3-notebook:latest',
  // Credentials for pulling `notebookImage`, only needed if it lives in a
  // private registry. `dockerRegistryServer` is optional -- it defaults to
  // the host parsed out of `notebookImage` itself (see
  // `registryHostFor` in `app/data/docker/provision.ts`), and only needs
  // setting explicitly if that doesn't resolve correctly.
  dockerRegistryUsername: process.env.DOCKER_REGISTRY_USERNAME,
  dockerRegistryPassword: process.env.DOCKER_REGISTRY_PASSWORD,
  dockerRegistryServer: process.env.DOCKER_REGISTRY_SERVER,
}
