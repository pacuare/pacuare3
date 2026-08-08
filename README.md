# Pacuare3

The v3 Pacuare Reserve web app. Its job is to manage per-user
[marimo](https://marimo.io) notebook sandboxes: each authorized user gets
their own **space** -- a Docker container running marimo, backed by its own
volume -- seeded with a copy of the reserve's `pacuare_raw` data, that they
can use to explore it. "Space" is deliberately generic: it's the unit
sharing will be built on top of later.

This app talks directly to the host's Docker daemon (via its Unix socket) to
create and manage spaces -- there's no third-party sandboxing service in the
loop.

## What it does

- **Google sign-in.** Users authenticate with Google OAuth2. Only emails on
  the authorized list (`authorized_users` table) can sign in.
- **Roles.** Authorized users are `member` or `admin`. Admins manage the
  authorized list from `/admin` -- adding people, changing roles, and
  removing access.
- **Notebook spaces.** Signed-in users can provision a space from `/`.
  Provisioning creates a container + volume, copies the `pacuare_raw` table
  from the main data database into the space's own local SQLite database,
  and starts a marimo notebook host on it. From settings, users can:
  - **Update** -- re-pull the latest notebook image and recreate the
    container from it, picking up a newer marimo/system without touching
    the volume (notebook code and database are untouched).
  - **Reset** -- re-seed the space with a fresh copy of `pacuare_raw`
    (leaves notebook code alone).
  - **Delete** -- remove the container and volume entirely.

## Two databases, on purpose

- `DATABASE_URL` -- this app's own database: `authorized_users`, cached
  Google profiles (`users`), and space provisioning records (`spaces`).
- `DATA_DATABASE_URL` -- a separate database holding the canonical
  `pacuare_raw` table. This app only reads from it, to seed new spaces.

## Two images, on purpose

- The root `Dockerfile` builds this app itself.
- `notebook/Dockerfile` builds the image every space's container runs: a
  fixed marimo + pandas install plus an entrypoint that seeds a space's
  volume on first boot (and re-seeds it when told to). This is the image
  "Update" re-pulls -- new marimo/Python versions ship by rebuilding and
  republishing this image, not by changing anything at runtime.

## Shape

- `app/actions/controller.tsx` owns the top-level route actions (home page).
- `app/actions/auth/`, `app/actions/notebook/`, `app/actions/admin/` own
  their route maps.
- `app/routes.ts` defines the route contract; `app/router.ts` wires routes,
  controllers, and middleware together.
- `app/middleware/` holds session, auth (Google OAuth2 + role checks), and
  render middleware.
- `app/data/` holds the app database schema/connection, the read-only data
  database connection, and the Docker Engine API client + space
  provisioning logic (`app/data/docker/`).
- `app/ui/` holds shared page UI.
- `db/migrations/` holds SQL migrations for the app database.
- `notebook/` holds the space container image: `Dockerfile`, its
  entrypoint, the bootstrap script that loads `pacuare_raw.csv` into
  SQLite, and the default notebook template.

## Setup

```sh
cp .env.example .env   # then fill in DATABASE_URL, GOOGLE_CLIENT_ID, etc.
npm i
npm run db:migrate
npm run dev
```

The `db:migrate` seed migration grants the first admin account. See
`.env.example` for every required variable.

This app needs access to a Docker daemon to provision spaces -- either run
it directly on a machine with Docker installed, or bind-mount the host's
`/var/run/docker.sock` into its own container. Build the notebook image
locally before provisioning a space for the first time:

```sh
docker build -t pacuare3-notebook:latest ./notebook
```

## Commands

```sh
npm i
npm run dev
npm run start
npm test
npm run lint
npm run typecheck
npm run db:migrate
```

## Testing

`npm test` always runs the pure unit tests (CSV encoding, space naming, the
tar builder, the Docker Engine API client against a real fake Unix-socket
server, HTTP-level route gating). Tests that need a real Postgres
(`app/middleware/auth.test.ts`, `app/data/data-source.test.ts`,
`app/data/docker/provision.test.ts`, and part of `app/router.test.ts`) skip
themselves when `DATABASE_URL` / `DATA_DATABASE_URL` aren't set, so
`npm test` passes with no infrastructure. To run the full suite locally,
point those at real (ideally disposable) databases -- the data database
needs a `pacuare_raw` table, see `.buildkite/postgres-init/01-init.sql` for
a minimal one:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pacuare_app_test \
DATA_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pacuare_data_test \
npm run db:migrate && npm test
```

The Docker-backed provisioning tests use an injectable fake (`ProvisionDeps`)
rather than a real daemon, so they don't need Docker available in the test
environment either.

## CI

`.buildkite/pipeline.yml` runs typecheck, lint, and the full test suite
(against a real Postgres via `.buildkite/docker-compose.yml`) on every push.
It also builds both `Dockerfile` (this app) and `notebook/Dockerfile` (the
space image) for `linux/amd64` and `linux/arm64/v8` and publishes
multi-platform images, tagged with the commit SHA and branch name, to the
`pacuare` Buildkite Package Registry
(`packages.buildkite.com/aleks-rutins/pacuare`) -- `pacuare3` for the app,
`pacuare3-notebook` for spaces -- for the existing container infrastructure
to deploy from and for "Update" to re-pull from.

Publishing authenticates with a short-lived Buildkite OIDC token rather than
a static credential -- the registry needs an OIDC policy configured (see
[OIDC in Buildkite Package
Registries](https://buildkite.com/docs/package-registries/security/oidc))
before the publish step will succeed.
