# Pacuare3 Agent Guide

This is the v3 Pacuare Reserve app: Google-authenticated management of
per-user marimo notebook "spaces" -- a Docker container + volume per user,
provisioned by talking directly to the host Docker daemon (no third-party
sandboxing service). It was scaffolded with `remix new`. Use these
conventions when continuing to build it out.

## Commands

```sh
npm i
npm run db:migrate
npm run dev
npm run start
npm test
npm run lint
npm run typecheck
```

`npm test` runs `remix test`, not `node --test` -- `remix/test`'s `describe`/`it`
only register suites into a global registry; only the `remix test` CLI
actually executes them. Plain `node --test` silently "passes" without
running any assertions. DB-backed tests (see `test/helpers.ts`) skip
themselves when `DATABASE_URL`/`DATA_DATABASE_URL` aren't set.

## Building Features

Refer to ./.agents/skills/remix/SKILL.md

## Layout

- `app/actions/controller.tsx` owns the top-level route actions (home page)
- `app/actions/auth/`, `app/actions/notebook/`, `app/actions/admin/` own their route maps
- `app/routes.ts` defines the route contract
- `app/router.ts` wires routes to route handlers and middleware
- `app/middleware/render.tsx` installs the request-scoped renderer used by actions
- `app/middleware/session.ts`, `app/middleware/auth.ts` set up sessions, Google OAuth2, and role checks
- `app/data/schema.ts`, `app/data/db.ts` are the app database (authorized users, cached Google profiles, space records)
- `app/data/data-source.ts` is the separate, read-only "data" database holding canonical `pacuare_raw`
- `app/data/docker/` is the Docker Engine API client and per-user space provisioning logic
- `db/migrations/` holds SQL migrations for the app database
- `notebook/` is the space container image (Dockerfile, entrypoint, bootstrap script, default notebook)
- `app/ui/` holds the shared document shell and page UI
- `app/assets.ts` owns the server-side asset pipeline used by the asset route and renderer
- `public/` contains static files served from the app root

## Authorization Model

`authorized_users` (email, role) is the single source of truth for who can
sign in and whether they're an admin. `users` is just a cache of Google
profile data for people who have signed in. The session auth scheme's
`verify()` re-checks `authorized_users` on every request, so revoking access
takes effect immediately -- don't duplicate role onto `users`.

## Route Ownership

- Start from `app/routes.ts` and map each route to the narrowest owner on disk.
- Put top-level route actions in `app/actions/controller.tsx`.
- Add `app/actions/<route-key>/controller.tsx` for nested route maps that need their own actions or middleware.
- Keep route-owned page modules next to the route that owns them.
- Move shared UI to `app/ui/`, not `app/actions/`.

## Build-Out Notes

- This starter intentionally begins small; add directories like `app/data/` and `test/` only when you need them.
- Prefer putting code in the narrowest owner before introducing shared modules.
- Avoid generic dumping-ground directories like `app/lib/` or `app/components/`.
