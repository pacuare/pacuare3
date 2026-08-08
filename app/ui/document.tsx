import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

import { routes } from '../routes.ts'

export interface DocumentProps {
  children?: RemixNode
  head?: RemixNode
  title?: string
}

const DEFAULT_TITLE = readAppDisplayName('Pacuare Reserve')

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let { children, head, title = DEFAULT_TITLE } = handle.props

    return (
      <html lang="en" mix={css({ margin: 0, background: '#16323C' })}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="manifest" href="/manifest.webmanifest" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <meta name="theme-color" content="#16323C" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-title" content="Pacuare" />
          <title>{title}</title>
          {head}
        </head>
        <body mix={css({ margin: 0 })}>
          {/* Fills the iOS safe-area inset (notch/status-bar strip) with the brand navy so an
              installed PWA's black-translucent status bar reads navy instead of the page
              background showing through. A no-op everywhere else, since the inset is 0. */}
          <div mix={statusBarFillStyle} />
          {children}
          <script type="module" src={routes.assets.href({ path: 'app/assets/entry.ts' })}></script>
        </body>
      </html>
    )
  }
}

const statusBarFillStyle = css({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: 'env(safe-area-inset-top, 0px)',
  background: '#16323C',
  zIndex: 9999,
  pointerEvents: 'none',
})

function readAppDisplayName(value: string): string {
  return value.startsWith('%%') ? 'Remix App' : decodeURIComponent(value)
}
