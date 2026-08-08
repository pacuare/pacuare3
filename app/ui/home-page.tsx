import { attrs, type Handle } from 'remix/ui'

import type { UserSprite } from '../data/schema.ts'
import type { AppUser } from '../middleware/auth.ts'
import { routes } from '../routes.ts'
import {
  badgeStyle,
  buttonStyle,
  dangerLinkButtonStyle,
  errorStyle,
  leadStyle,
  linkButtonStyle,
  noticeStyle,
  PageShell,
  rowStyle,
  statusBoxStyle,
  titleStyle,
} from './page-shell.tsx'

export interface HomePageProps {
  user: AppUser | null
  sprite: UserSprite | null
  error: string | null
  message: string | null
  csrfToken: string
  loginHref: string
}

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized:
    "That Google account isn't on the Pacuare Reserve authorized list. Ask an admin to add you.",
  google_no_email: 'Google did not share an email address for that account.',
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { user, sprite, error, message, csrfToken, loginHref } = handle.props

    return (
      <PageShell title="Pacuare Reserve">
        <h1 mix={titleStyle}>Pacuare Reserve</h1>
        {error && ERROR_MESSAGES[error] && <p mix={errorStyle}>{ERROR_MESSAGES[error]}</p>}
        {message && <p mix={noticeStyle}>{message}</p>}
        {user ? (
          <SignedIn user={user} sprite={sprite} csrfToken={csrfToken} />
        ) : (
          <SignedOut loginHref={loginHref} />
        )}
      </PageShell>
    )
  }
}

function SignedOut(handle: Handle<{ loginHref: string }>) {
  return () => (
    <div mix={rowStyle}>
      <p mix={leadStyle}>Sign in with your Google account to access your notebook environment.</p>
      {/* rmx-document: /auth/google issues a redirect to an external origin, which the
          client-side navigation runtime can't follow -- force a full document navigation. */}
      <a
        href={handle.props.loginHref}
        mix={[buttonStyle, attrs({ 'rmx-document': '' })]}
      >
        Sign in with Google
      </a>
    </div>
  )
}

function SignedIn(handle: Handle<{ user: AppUser; sprite: UserSprite | null; csrfToken: string }>) {
  return () => {
    let { user, sprite, csrfToken } = handle.props
    return (
      <>
        <p mix={leadStyle}>
          Signed in as <strong>{user.name}</strong> ({user.email})
          {user.role === 'admin' && <span mix={badgeStyle}>admin</span>}
        </p>

        <NotebookStatus sprite={sprite} csrfToken={csrfToken} />

        <div mix={rowStyle}>
          {user.role === 'admin' && (
            <a href={routes.admin.index.href()} mix={linkButtonStyle}>
              Manage authorized users
            </a>
          )}
          <form method="post" action={routes.auth.logout.href()}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <button type="submit" mix={linkButtonStyle}>
              Sign out
            </button>
          </form>
        </div>
      </>
    )
  }
}

/** The sprite's URL, with marimo's access token attached so the link logs the user straight in. */
function notebookOpenUrl(sprite: UserSprite): string | null {
  if (!sprite.notebook_url) return null
  if (!sprite.notebook_token) return sprite.notebook_url
  return `${sprite.notebook_url}?access_token=${encodeURIComponent(sprite.notebook_token)}`
}

function NotebookStatus(handle: Handle<{ sprite: UserSprite | null; csrfToken: string }>) {
  return () => {
    let { sprite, csrfToken } = handle.props

    if (!sprite || sprite.status === 'deleted') {
      return (
        <div mix={statusBoxStyle}>
          <p mix={leadStyle}>You don't have a notebook environment yet.</p>
          <form method="post" action={routes.notebook.provision.href()}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <button type="submit" mix={buttonStyle}>
              Set up my notebook
            </button>
          </form>
        </div>
      )
    }

    if (sprite.status === 'provisioning') {
      return (
        <div mix={statusBoxStyle}>
          <p mix={leadStyle}>
            Setting up your notebook environment. This copies the reserve data into your own
            sandbox and starts marimo -- it can take a minute.
          </p>
          <a href={routes.home.href()} mix={linkButtonStyle}>
            Refresh
          </a>
        </div>
      )
    }

    if (sprite.status === 'error') {
      return (
        <div mix={statusBoxStyle}>
          <p mix={errorStyle}>
            Something went wrong setting up your notebook{sprite.last_error ? `: ${sprite.last_error}` : '.'}
          </p>
          <form method="post" action={routes.notebook.provision.href()}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <button type="submit" mix={buttonStyle}>
              Try again
            </button>
          </form>
        </div>
      )
    }

    let openUrl = notebookOpenUrl(sprite)

    return (
      <div mix={statusBoxStyle}>
        <p mix={leadStyle}>Your notebook environment is ready.</p>
        <div mix={rowStyle}>
          {openUrl && (
            <a href={openUrl} target="_blank" rel="noreferrer" mix={buttonStyle}>
              Open notebook
            </a>
          )}
          <form method="post" action={routes.notebook.reset.href()}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <button type="submit" mix={linkButtonStyle}>
              Reset
            </button>
          </form>
          <form method="post" action={routes.notebook.destroy.href()}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <button type="submit" mix={dangerLinkButtonStyle}>
              Delete
            </button>
          </form>
        </div>
      </div>
    )
  }
}
