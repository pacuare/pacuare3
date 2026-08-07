# Pacuare3

The v3 Pacuare Reserve web app. Its job is to manage per-user
[marimo](https://marimo.io) notebook sandboxes: each authorized user gets
their own [Sprites.dev](https://sprites.dev) sandbox, seeded with a copy of
the reserve's `pacuare_raw` data, running a marimo notebook host they can use
to explore it.

## What it does

- **Google sign-in.** Users authenticate with Google OAuth2. Only emails on
  the authorized list (`authorized_users` table) can sign in.
- **Roles.** Authorized users are `member` or `admin`. Admins manage the
  authorized list from `/admin` -- adding people, changing roles, and
  removing access.
- **Notebook sandboxes.** Signed-in users can provision a Sprites.dev sprite
  from `/`. Provisioning copies the `pacuare_raw` table from the main data
  database into the sprite's own local SQLite database and starts a marimo
  notebook host on it. Users can reset (re-seed with fresh data) or delete
  their sandbox from the same page.

## Two databases, on purpose

- `DATABASE_URL` -- this app's own database: `authorized_users`, cached
  Google profiles (`users`), and sprite provisioning records
  (`user_sprites`).
- `DATA_DATABASE_URL` -- a separate database holding the canonical
  `pacuare_raw` table. This app only reads from it, to seed new sprites.

## Shape

- `app/actions/controller.tsx` owns the top-level route actions (home page).
- `app/actions/auth/`, `app/actions/notebook/`, `app/actions/admin/` own
  their route maps.
- `app/routes.ts` defines the route contract; `app/router.ts` wires routes,
  controllers, and middleware together.
- `app/middleware/` holds session, auth (Google OAuth2 + role checks), and
  render middleware.
- `app/data/` holds the app database schema/connection, the read-only data
  database connection, and the Sprites.dev client + provisioning logic
  (`app/data/sprites/`).
- `app/ui/` holds shared page UI.
- `db/migrations/` holds SQL migrations for the app database.

## Setup

```sh
cp .env.example .env   # then fill in DATABASE_URL, GOOGLE_CLIENT_ID, etc.
npm i
npm run db:migrate
npm run dev
```

The `db:migrate` seed migration grants the first admin account. See
`.env.example` for every required variable.

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

`npm test` always runs the pure unit tests (CSV encoding, sprite naming, the
Sprites.dev REST client against a mocked `fetch`, HTTP-level route gating).
Tests that need a real Postgres (`app/middleware/auth.test.ts`,
`app/data/data-source.test.ts`, `app/data/sprites/provision.test.ts`, and
part of `app/router.test.ts`) skip themselves when `DATABASE_URL` /
`DATA_DATABASE_URL` aren't set, so `npm test` passes with no infrastructure.
To run the full suite locally, point those at real (ideally disposable)
databases -- the data database needs a `pacuare_raw` table, see
`.buildkite/postgres-init/01-init.sql` for a minimal one:

```sh
DATABASE_URL=postgres://postgres:postgres@localhost:5432/pacuare_app_test \
DATA_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pacuare_data_test \
npm run db:migrate && npm test
```

## CI

`.buildkite/pipeline.yml` runs typecheck, lint, and the full test suite
(against a real Postgres via `.buildkite/docker-compose.yml`) on every push.

## Deploying to Cloudflare

This app is Node-native -- `app/assets.ts` compiles browser assets on demand
from source files on disk, and `app/data/db.ts` / `app/data/data-source.ts`
hold real `pg` TCP connections -- so it can't run as a plain Cloudflare
Worker. Instead it deploys as a [Cloudflare
Container](https://developers.cloudflare.com/containers/): the app runs
unchanged in the Docker image built from `Dockerfile`, fronted by the thin
Worker in `workers/container.ts` that routes all traffic to a single
container instance.

One-time setup:

```sh
npx wrangler login

# Non-secret config lives in wrangler.jsonc under "vars" -- update
# APP_ORIGIN to the real deployed origin and GOOGLE_CLIENT_ID before
# deploying, and add that origin's /auth/google/callback as an authorized
# redirect URI in the Google Cloud console.

npx wrangler secret put DATABASE_URL
npx wrangler secret put DATA_DATABASE_URL
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SPRITES_TOKEN
```

Run migrations against the production `DATABASE_URL` before the first
deploy, and again after any migration changes -- `npm run db:migrate` just
needs network access to the database, so run it from CI or any machine that
has it:

```sh
DATABASE_URL=<production DATABASE_URL> npm run db:migrate
```

Then build and deploy:

```sh
npm run deploy
```

`npm run cf:dev` runs the Worker + container locally with `wrangler dev`
(requires a local Docker daemon).
