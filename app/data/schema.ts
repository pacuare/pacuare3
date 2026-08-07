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

export const userSprites = table({
  name: 'user_sprites',
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    user_id: c.integer().notNull().references('users', 'id').onDelete('cascade'),
    name: c.text().notNull().unique(),
    status: c
      .enum(['provisioning', 'ready', 'error', 'deleted'] as const)
      .notNull()
      .default('provisioning'),
    notebook_url: c.text().nullable(),
    // marimo's own access-token, extracted from the "marimo" service's startup
    // logs -- lets the "Open notebook" link log the user straight in instead
    // of landing on marimo's token prompt.
    notebook_token: c.text().nullable(),
    last_error: c.text().nullable(),
    created_at: c.timestamp().notNull().defaultNow(),
    updated_at: c.timestamp().notNull().defaultNow(),
  },
})

export type AuthorizedUser = TableRow<typeof authorizedUsers>
export type User = TableRow<typeof users>
export type UserSprite = TableRow<typeof userSprites>
