import { createController } from 'remix/router'
import { Auth } from 'remix/middleware/auth'
import { Database } from 'remix/data-table'
import { getCsrfToken } from 'remix/middleware/csrf'
import { Session } from 'remix/session'

import { assetServer } from '../assets.ts'
import { userSprites } from '../data/schema.ts'
import type { AppUser } from '../middleware/auth.ts'
import { routes } from '../routes.ts'
import { HomePage } from '../ui/home-page.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
      )
    },

    async home(context) {
      let authState = context.get(Auth)
      let error = context.url.searchParams.get('error')
      let session = context.get(Session)
      let message = session.get('message')
      let csrfToken = getCsrfToken(context)

      if (!authState.ok) {
        return context.render(
          <HomePage
            user={null}
            sprite={null}
            error={error}
            message={typeof message === 'string' ? message : null}
            csrfToken={csrfToken}
            loginHref={routes.auth.google.index.href()}
          />,
        )
      }

      let user = authState.identity as AppUser
      let db = context.get(Database)
      let sprite = await db.findOne(userSprites, { where: { user_id: user.id } })

      return context.render(
        <HomePage
          user={user}
          sprite={sprite ?? null}
          error={error}
          message={typeof message === 'string' ? message : null}
          csrfToken={csrfToken}
          loginHref={routes.auth.google.index.href()}
        />,
      )
    },
  },
})
