import { createController } from 'remix/router'
import { Auth, requireAuth } from 'remix/middleware/auth'
import { Database } from 'remix/data-table'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { email as emailCheck } from 'remix/data-schema/checks'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { Session } from 'remix/session'

import { authorizedUsers } from '../../data/schema.ts'
import { requireAdmin, type AppUser } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { AdminPage } from '../../ui/admin-page.tsx'

let addUserSchema = f.object({
  email: f.field(s.string().pipe(emailCheck())),
  role: f.field(s.union([s.literal('admin' as const), s.literal('member' as const)])),
})

let roleSchema = f.object({
  role: f.field(s.union([s.literal('admin' as const), s.literal('member' as const)])),
})

export default createController(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    async index(context) {
      let db = context.get(Database)
      let admin = context.get(Auth).identity as AppUser
      let session = context.get(Session)
      let allUsers = await db.findMany(authorizedUsers, { orderBy: ['created_at', 'asc'] })
      let message = session.get('message')

      return context.render(
        <AdminPage
          admin={admin}
          users={allUsers}
          message={typeof message === 'string' ? message : null}
          csrfToken={getCsrfToken(context)}
        />,
      )
    },

    async addUser(context) {
      let db = context.get(Database)
      let admin = context.get(Auth).identity as AppUser
      let session = context.get(Session)

      let parsed = s.parseSafe(addUserSchema, context.get(FormData))
      if (!parsed.success) {
        session.flash('message', 'Enter a valid email address and role.')
        return redirect(routes.admin.index.href())
      }

      let email = parsed.value.email.trim().toLowerCase()
      let existing = await db.find(authorizedUsers, email)
      if (existing) {
        await db.update(authorizedUsers, email, { role: parsed.value.role })
      } else {
        await db.create(authorizedUsers, {
          email,
          role: parsed.value.role,
          added_by: admin.email,
        })
      }

      session.flash('message', `Added ${email} as ${parsed.value.role}.`)
      return redirect(routes.admin.index.href())
    },

    async setRole(context) {
      let db = context.get(Database)
      let admin = context.get(Auth).identity as AppUser
      let session = context.get(Session)
      let targetEmail = decodeURIComponent(context.params.email)

      let parsed = s.parseSafe(roleSchema, context.get(FormData))
      if (!parsed.success) {
        session.flash('message', 'Invalid role.')
        return redirect(routes.admin.index.href())
      }

      if (targetEmail === admin.email && parsed.value.role !== 'admin') {
        session.flash('message', 'You cannot remove your own admin role.')
        return redirect(routes.admin.index.href())
      }

      await db.update(authorizedUsers, targetEmail, { role: parsed.value.role })
      session.flash('message', `Updated ${targetEmail} to ${parsed.value.role}.`)
      return redirect(routes.admin.index.href())
    },

    async removeUser(context) {
      let admin = context.get(Auth).identity as AppUser
      let session = context.get(Session)
      let targetEmail = decodeURIComponent(context.params.email)

      if (targetEmail === admin.email) {
        session.flash('message', 'You cannot remove yourself from the authorized list.')
        return redirect(routes.admin.index.href())
      }

      let db = context.get(Database)
      await db.delete(authorizedUsers, targetEmail)
      session.flash('message', `Removed ${targetEmail}.`)
      return redirect(routes.admin.index.href())
    },
  },
})
