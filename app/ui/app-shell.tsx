import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

import type { AppUser } from '../middleware/auth.ts'
import { routes } from '../routes.ts'
import { Document } from './document.tsx'
import { HomeIcon, SettingsIcon } from './icons.tsx'

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export interface AppShellProps {
  user: AppUser
  active: 'home' | 'settings'
  title?: string
  children?: RemixNode
  /** Whether the content area gets its own padding, or fills edge-to-edge (e.g. an iframe). */
  padded?: boolean
}

export function AppShell(handle: Handle<AppShellProps>) {
  return () => {
    let { user, active, title, children, padded = true } = handle.props

    return (
      <Document title={title}>
        <div mix={shellStyle}>
          <nav mix={sidebarStyle}>
            <div mix={sidebarTopStyle}>
              <img src="/logo.png" alt="Pacuare Reserve" mix={logoStyle} />
              <a
                href={routes.home.href()}
                mix={active === 'home' ? [iconLinkStyle, activeIconLinkStyle] : iconLinkStyle}
                aria-label="Home"
              >
                <HomeIcon />
              </a>
            </div>
            <div mix={sidebarBottomStyle}>
              <a
                href={routes.settings.index.href()}
                mix={active === 'settings' ? [iconLinkStyle, activeIconLinkStyle] : iconLinkStyle}
                aria-label="Settings"
              >
                <SettingsIcon />
              </a>
              <a href={routes.settings.index.href()} mix={avatarStyle} aria-label={user.name}>
                <AvatarContent user={user} />
              </a>
            </div>
          </nav>
          <main mix={padded ? [contentStyle, contentPaddingStyle] : contentStyle}>{children}</main>
        </div>
      </Document>
    )
  }
}

/** A user's Google profile picture, falling back to their initials when there isn't one. */
export function AvatarContent(handle: Handle<{ user: AppUser }>) {
  return () => {
    let { user } = handle.props
    return user.pictureUrl ? (
      <img src={user.pictureUrl} alt="" referrerPolicy="no-referrer" mix={avatarImageStyle} />
    ) : (
      initials(user.name)
    )
  }
}

export function initials(name: string): string {
  let parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  let first = parts[0]?.[0] ?? ''
  let last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

const shellStyle = css({
  '& *, & *::before, & *::after': { boxSizing: 'border-box' },
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  padding: '16px',
  boxSizing: 'border-box',
  width: '100%',
  height: '100vh',
  background: '#16323C',
  fontFamily: FONT_STACK,
  fontSize: '15px',
  lineHeight: 1.5,
})

const sidebarStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  alignSelf: 'stretch',
  width: '41px',
  flexShrink: 0,
  gap: '16px',
})

const sidebarTopStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  alignSelf: 'stretch',
  gap: '8px',
})

const sidebarBottomStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  alignSelf: 'stretch',
  gap: '13px',
})

const logoStyle = css({
  alignSelf: 'stretch',
  height: '46px',
  flexShrink: 0,
  objectFit: 'cover',
})

const iconLinkStyle = css({
  display: 'flex',
  flexShrink: 0,
  padding: '4px',
  borderRadius: '8px',
  color: '#FFFFFF',
  textDecoration: 'none',
  cursor: 'pointer',
})

const activeIconLinkStyle = css({
  background: 'rgba(255, 255, 255, 0.16)',
})

const avatarStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '44px',
  height: '44px',
  flexShrink: 0,
  borderRadius: '9999px',
  overflow: 'hidden',
  background: '#FFFFFF',
  color: '#000000',
  fontSize: '16px',
  lineHeight: '20px',
  textDecoration: 'none',
  cursor: 'pointer',
})

export const avatarImageStyle = css({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
})

const contentStyle = css({
  flex: '1 1 0%',
  alignSelf: 'stretch',
  borderRadius: '14px',
  background: '#FFFFFF',
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
})

const contentPaddingStyle = css({
  padding: '48px',
})

/** Fixed (non theme-adaptive) styles for content rendered inside AppShell -- the design's
 * white content card and dark navy sidebar don't follow the system color scheme. */

export const centerColumnStyle = css({
  flex: '1 1 0%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '20px',
  textAlign: 'center',
})

export const sectionStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  maxWidth: '640px',
  width: '100%',
})

export const contentTitleStyle = css({
  margin: 0,
  fontSize: '22px',
  fontWeight: 700,
  color: '#16323C',
})

export const contentTextStyle = css({
  margin: 0,
  fontSize: '16px',
  lineHeight: '20px',
  color: '#000000',
})

export const contentMutedTextStyle = css({
  margin: 0,
  fontSize: '14px',
  color: '#5b6470',
})

export const rowStyle = css({
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  alignItems: 'center',
})

export const primaryButtonStyle = css({
  appearance: 'none',
  border: 0,
  borderRadius: '5px',
  padding: '10px 15px',
  fontSize: '16px',
  fontFamily: 'inherit',
  color: '#FFFFFF',
  background: '#16323C',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover, &:focus-visible': {
    background: '#0f242c',
    outline: 'none',
  },
})

export const secondaryButtonStyle = css({
  appearance: 'none',
  border: '1px solid #dde2e7',
  borderRadius: '5px',
  padding: '10px 15px',
  fontSize: '14px',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: '#16323C',
  background: 'transparent',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover, &:focus-visible': {
    background: '#eef1f4',
    outline: 'none',
  },
})

export const dangerButtonStyle = css({
  appearance: 'none',
  border: '1px solid #b3261e',
  borderRadius: '5px',
  padding: '10px 15px',
  fontSize: '14px',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: '#b3261e',
  background: 'transparent',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover, &:focus-visible': {
    background: '#fbeae9',
    outline: 'none',
  },
})

export const errorStyle = css({
  margin: 0,
  padding: '10px 12px',
  borderRadius: '8px',
  background: '#fbeae9',
  color: '#b3261e',
  fontSize: '14px',
})

export const noticeStyle = css({
  margin: 0,
  padding: '10px 12px',
  borderRadius: '8px',
  background: '#eef1f4',
  color: '#16323C',
  fontSize: '14px',
})

export const badgeStyle = css({
  marginLeft: '8px',
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  background: '#16323C',
  color: '#ffffff',
})

export const statusBoxStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  borderRadius: '12px',
  background: '#eef1f4',
})

export const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px',
  '& th, & td': {
    textAlign: 'left',
    padding: '8px 6px',
    borderBottom: '1px solid #dde2e7',
  },
  '& th': {
    color: '#5b6470',
    fontWeight: 600,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
})

export const inputStyle = css({
  appearance: 'none',
  border: '1px solid #dde2e7',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '14px',
  fontFamily: 'inherit',
  color: '#000000',
  background: '#FFFFFF',
  '&:focus-visible': {
    outline: '2px solid #16323C',
    outlineOffset: '-1px',
  },
})
