import { createController } from 'remix/router'
import { completeAuth, finishExternalAuth, startExternalAuth } from 'remix/auth'
import { redirect } from 'remix/response/redirect'
import { Database } from 'remix/data-table'

import { authorizedUsers, users, type User } from '../../../data/schema.ts'
import { googleProvider } from '../../../middleware/auth.ts'
import { routes } from '../../../routes.ts'

export default createController(routes.auth.google, {
  actions: {
    async index(context) {
      return await startExternalAuth(googleProvider, context, {
        returnTo: context.url.searchParams.get('returnTo'),
      })
    },

    async callback(context) {
      let { result, returnTo } = await finishExternalAuth(googleProvider, context)
      let email = result.profile.email

      if (!email) {
        return redirect(routes.home.href() + '?error=google_no_email')
      }

      let db = context.get(Database)

      let authorized = await db.findOne(authorizedUsers, { where: { email } })
      if (!authorized) {
        return redirect(routes.home.href() + '?error=not_authorized')
      }

      let existing = await db.findOne(users, { where: { email } })

      let user: User
      if (existing) {
        user = await db.update(users, existing.id, {
          google_sub: result.account.providerAccountId,
          name: result.profile.name ?? existing.name,
          picture_url: result.profile.picture ?? null,
          last_login_at: new Date(),
        })
      } else {
        user = await db.create(
          users,
          {
            email,
            google_sub: result.account.providerAccountId,
            name: result.profile.name ?? email,
            picture_url: result.profile.picture ?? null,
            last_login_at: new Date(),
          },
          { returnRow: true },
        )
      }

      let session = completeAuth(context)
      session.set('auth', { userId: user.id })

      return redirect(returnTo ?? routes.home.href())
    },
  },
})
