import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { Session } from 'remix/session'

import { routes } from '../../routes.ts'

export default createController(routes.auth, {
  actions: {
    logout(context) {
      let session = context.get(Session)
      session.unset('auth')
      session.regenerateId(true)
      return redirect(routes.home.href())
    },
  },
})
