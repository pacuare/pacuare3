import { createController } from 'remix/router'
import { Auth, requireAuth } from 'remix/middleware/auth'
import { Database } from 'remix/data-table'
import { getCsrfToken } from 'remix/middleware/csrf'
import { Session } from 'remix/session'

import { authorizedUsers, spaces } from '../../data/schema.ts'
import type { AppUser } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { SettingsPage } from '../../ui/settings-page.tsx'

export default createController(routes.settings, {
  middleware: [requireAuth()],
  actions: {
    async index(context) {
      let db = context.get(Database)
      let user = context.get(Auth).identity as AppUser
      let session = context.get(Session)

      let space = await db.findOne(spaces, { where: { user_id: user.id } })
      let allUsers =
        user.role === 'admin'
          ? await db.findMany(authorizedUsers, { orderBy: ['created_at', 'asc'] })
          : null
      let message = session.get('message')

      return context.render(
        <SettingsPage
          user={user}
          space={space ?? null}
          authorizedUsers={allUsers}
          message={typeof message === 'string' ? message : null}
          csrfToken={getCsrfToken(context)}
        />,
      )
    },
  },
})
