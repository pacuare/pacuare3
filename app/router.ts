import { createRouter, type MiddlewareContext } from 'remix/router'
import { staticFiles } from 'remix/middleware/static'
import { formData } from 'remix/middleware/form-data'
import { csrf } from 'remix/middleware/csrf'
import { session } from 'remix/middleware/session'

import controller from './actions/controller.tsx'
import authController from './actions/auth/controller.tsx'
import authGoogleController from './actions/auth/google/controller.tsx'
import notebookController from './actions/notebook/controller.tsx'
import adminController from './actions/admin/controller.tsx'
import { loadAuth } from './middleware/auth.ts'
import { loadDatabase } from './data/db.ts'
import { render } from './middleware/render.tsx'
import { sessionCookie, sessionStorage } from './middleware/session.ts'
import { routes } from './routes.ts'
import { env } from './data/env.ts'

type AppContext = MiddlewareContext<
  [
    ReturnType<typeof render>,
    ReturnType<typeof session>,
    ReturnType<typeof formData>,
    ReturnType<typeof csrf>,
    ReturnType<typeof loadDatabase>,
    ReturnType<typeof loadAuth>,
  ]
>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({
  middleware: [
    staticFiles('./public', { index: false }),
    render(),
    session(sessionCookie, sessionStorage),
    formData(),
    csrf({ origin: env.appOrigin }),
    loadDatabase(),
    loadAuth(),
  ],
})

router.map(routes, controller)
router.map(routes.auth, authController)
router.map(routes.auth.google, authGoogleController)
router.map(routes.notebook, notebookController)
router.map(routes.admin, adminController)
