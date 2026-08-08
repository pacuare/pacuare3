import { column as c, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'

// The allowlist of who may sign in, and their role. This is the single
// source of truth for authorization -- `users` below is just a cache of
// Google profile data for people who have actually signed in.
export const authorizedUsers = table({
  name: 'authorized_users',
  primaryKey: 'email',
  columns: {
    email: c.text().primaryKey(),
    role: c.enum(['admin', 'member'] as const).notNull().default('member'),
    added_by: c.text().nullable(),
    created_at: c.timestamp().notNull().defaultNow(),
  },
})

export const users = table({
  name: 'users',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    email: c.text().notNull().unique(),
    google_sub: c.text().notNull().unique(),
    name: c.text().notNull(),
    picture_url: c.text().nullable(),
    created_at: c.timestamp().notNull().defaultNow(),
    last_login_at: c.timestamp().nullable(),
  },
})

// A user's personal Docker-backed sandbox: one container running marimo,
// backed by one volume holding its SQLite database and notebook code. Named
// "space" (rather than e.g. "sandbox") because sharing -- letting more than
// one user work in the same space -- is the next thing built on top of this.
export const spaces = table({
  name: 'spaces',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    user_id: c.integer().notNull().references('users', 'id').onDelete('cascade'),
    name: c.text().notNull().unique(),
    status: c
      .enum(['provisioning', 'ready', 'error', 'deleted'] as const)
      .notNull()
      .default('provisioning'),
    // The running container backing this space, if any -- looked up again on
    // every provision/update/destroy rather than trusted as always current.
    container_id: c.text().nullable(),
    // Address of the space's container on the Docker network, e.g.
    // `http://172.19.0.5:8080` -- what the notebook proxy dials.
    notebook_url: c.text().nullable(),
    // marimo's own access-token, generated at provision time and passed to
    // the container via env -- lets the "Open notebook" link log the user
    // straight in instead of landing on marimo's token prompt.
    notebook_token: c.text().nullable(),
    last_error: c.text().nullable(),
    created_at: c.timestamp().notNull().defaultNow(),
    updated_at: c.timestamp().notNull().defaultNow(),
  },
})

export type AuthorizedUser = TableRow<typeof authorizedUsers>
export type User = TableRow<typeof users>
export type Space = TableRow<typeof spaces>
