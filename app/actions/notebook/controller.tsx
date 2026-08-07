import { createController } from 'remix/router'
import { Auth, requireAuth } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'
import { Session } from 'remix/session'

import { destroyUserSprite, provisionUserSprite } from '../../data/sprites/provision.ts'
import type { AppUser } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'

export default createController(routes.notebook, {
  middleware: [requireAuth()],
  actions: {
    async provision(context) {
      let user = context.get(Auth).identity as AppUser
      let session = context.get(Session)
      try {
        await provisionUserSprite(user)
        session.flash('message', 'Your notebook is ready.')
      } catch (error) {
        session.flash(
          'message',
          `Failed to set up your notebook: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      return redirect(routes.home.href())
    },

    async reset(context) {
      let user = context.get(Auth).identity as AppUser
      let session = context.get(Session)
      try {
        await provisionUserSprite(user)
        session.flash('message', 'Your notebook has been reset with a fresh copy of the data.')
      } catch (error) {
        session.flash(
          'message',
          `Failed to reset your notebook: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      return redirect(routes.home.href())
    },

    async destroy(context) {
      let user = context.get(Auth).identity as AppUser
      let session = context.get(Session)
      await destroyUserSprite(user)
      session.flash('message', 'Your notebook has been deleted.')
      return redirect(routes.home.href())
    },
  },
})
