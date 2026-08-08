import { attrs, css, type Handle } from 'remix/ui'

import type { UserSprite } from '../data/schema.ts'
import type { AppUser } from '../middleware/auth.ts'
import { routes } from '../routes.ts'
import {
  buttonStyle,
  errorStyle,
  leadStyle,
  noticeStyle,
  PageShell,
  rowStyle,
  titleStyle,
} from './page-shell.tsx'
import {
  AppShell,
  centerColumnStyle,
  contentMutedTextStyle,
  contentTextStyle,
  errorStyle as contentErrorStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './app-shell.tsx'

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

    if (!user) {
      return (
        <PageShell title="Pacuare Reserve">
          <h1 mix={titleStyle}>Pacuare Reserve</h1>
          {error && ERROR_MESSAGES[error] && <p mix={errorStyle}>{ERROR_MESSAGES[error]}</p>}
          {message && <p mix={noticeStyle}>{message}</p>}
          <SignedOut loginHref={loginHref} />
        </PageShell>
      )
    }

    return (
      <AppShell user={user} active="home" title="Pacuare Reserve" padded={sprite?.status !== 'ready'}>
        {sprite?.status === 'ready' ? (
          <NotebookFrame sprite={sprite} />
        ) : (
          <NotebookOnboarding sprite={sprite} error={error} message={message} csrfToken={csrfToken} />
        )}
      </AppShell>
    )
  }
}

function SignedOut(handle: Handle<{ loginHref: string }>) {
  return () => (
    <div mix={rowStyle}>
      <p mix={leadStyle}>Sign in with your Google account to access your notebook environment.</p>
      {/* rmx-document: /auth/google issues a redirect to an external origin, which the
          client-side navigation runtime can't follow -- force a full document navigation. */}
      <a href={handle.props.loginHref} mix={[buttonStyle, attrs({ 'rmx-document': '' })]}>
        Sign in with Google
      </a>
    </div>
  )
}

const iframeStyle = css({ border: '0', width: '100%', height: '100%', flex: '1' })

function NotebookFrame(handle: Handle<{ sprite: UserSprite }>) {
  return () => {
    let { sprite } = handle.props
    if (!sprite.notebook_url) return null
    // Proxied through our own origin (see app/middleware/notebook-proxy.ts)
    // rather than linking straight to the sprite's cross-site URL: marimo's
    // session cookie can't survive being set from inside a cross-site
    // iframe, so the notebook needs to look same-origin to the browser.
    return <iframe src="/notebook/app/" title="Your notebook" mix={iframeStyle} />
  }
}

function NotebookOnboarding(
  handle: Handle<{
    sprite: UserSprite | null
    error: string | null
    message: string | null
    csrfToken: string
  }>,
) {
  return () => {
    let { sprite, error, message, csrfToken } = handle.props

    return (
      <div mix={centerColumnStyle}>
        {error && ERROR_MESSAGES[error] && <p mix={contentErrorStyle}>{ERROR_MESSAGES[error]}</p>}
        {message && <p mix={contentMutedTextStyle}>{message}</p>}

        {(!sprite || sprite.status === 'deleted') && (
          <>
            <p mix={contentTextStyle}>You have not yet initialized your notebook server.</p>
            <form method="post" action={routes.notebook.provision.href()}>
              <input type="hidden" name="_csrf" value={csrfToken} />
              <button type="submit" mix={primaryButtonStyle}>
                Initialize
              </button>
            </form>
          </>
        )}

        {sprite?.status === 'provisioning' && (
          <>
            <p mix={contentTextStyle}>
              Setting up your notebook environment. This copies the reserve data into your own
              sandbox and starts marimo -- it can take a minute.
            </p>
            <a href={routes.home.href()} mix={secondaryButtonStyle}>
              Refresh
            </a>
          </>
        )}

        {sprite?.status === 'error' && (
          <>
            <p mix={contentErrorStyle}>
              Something went wrong setting up your notebook
              {sprite.last_error ? `: ${sprite.last_error}` : '.'}
            </p>
            <form method="post" action={routes.notebook.provision.href()}>
              <input type="hidden" name="_csrf" value={csrfToken} />
              <button type="submit" mix={primaryButtonStyle}>
                Try again
              </button>
            </form>
          </>
        )}
      </div>
    )
  }
}
