import type { Handle, RemixNode } from 'remix/ui'
import { css } from 'remix/ui'

import { Document } from './document.tsx'

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export interface PageShellProps {
  children?: RemixNode
  head?: RemixNode
  title?: string
  wide?: boolean
}

export function PageShell(handle: Handle<PageShellProps>) {
  return () => {
    let { children, head, title, wide = false } = handle.props

    return (
      <Document title={title} head={head}>
        <main mix={pageStyle}>
          <div mix={wide ? [cardStyle, wideCardStyle] : cardStyle}>{children}</div>
        </main>
      </Document>
    )
  }
}

const pageStyle = css({
  '--surface-0': '#f3f5f7',
  '--surface-1': '#ffffff',
  '--surface-2': '#eef1f4',
  '--text-primary': '#1c2024',
  '--text-secondary': '#5b6470',
  '--brand-green': '#1f7a4d',
  '--brand-green-hover': '#186139',
  '--border': '#dde2e7',
  '--error': '#b3261e',
  '--error-bg': '#fbeae9',
  '--notice-bg': '#eaf4ee',
  '@media (prefers-color-scheme: dark)': {
    '--surface-0': '#15181b',
    '--surface-1': '#1e2226',
    '--surface-2': '#25292e',
    '--text-primary': '#eef1f4',
    '--text-secondary': '#9aa4af',
    '--brand-green': '#3fbb7d',
    '--brand-green-hover': '#5bd193',
    '--border': '#2e3338',
    '--error': '#ff8983',
    '--error-bg': '#3a1f1e',
    '--notice-bg': '#1c2e24',
  },
  '& *, & *::before, & *::after': { boxSizing: 'border-box' },
  margin: 0,
  padding: '48px 20px',
  minHeight: '100vh',
  background: 'var(--surface-0)',
  color: 'var(--text-primary)',
  fontFamily: FONT_STACK,
  fontSize: '15px',
  lineHeight: 1.5,
  display: 'flex',
  justifyContent: 'center',
})

const cardStyle = css({
  width: '100%',
  maxWidth: '480px',
  height: 'fit-content',
  background: 'var(--surface-1)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  padding: '32px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
})

const wideCardStyle = css({ maxWidth: '760px' })

export const titleStyle = css({
  margin: 0,
  fontSize: '22px',
  fontWeight: 700,
})

export const leadStyle = css({
  margin: 0,
  color: 'var(--text-secondary)',
})

export const rowStyle = css({
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  alignItems: 'center',
})

export const buttonStyle = css({
  appearance: 'none',
  border: 0,
  borderRadius: '10px',
  padding: '10px 16px',
  fontSize: '14px',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: '#ffffff',
  background: 'var(--brand-green)',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover, &:focus-visible': {
    background: 'var(--brand-green-hover)',
    outline: 'none',
  },
})

export const linkButtonStyle = css({
  appearance: 'none',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 16px',
  fontSize: '14px',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  background: 'transparent',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover, &:focus-visible': {
    background: 'var(--surface-2)',
    outline: 'none',
  },
})

export const dangerLinkButtonStyle = css({
  appearance: 'none',
  border: '1px solid var(--error)',
  borderRadius: '10px',
  padding: '10px 16px',
  fontSize: '14px',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--error)',
  background: 'transparent',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '&:hover, &:focus-visible': {
    background: 'var(--error-bg)',
    outline: 'none',
  },
})

export const errorStyle = css({
  margin: 0,
  padding: '10px 12px',
  borderRadius: '8px',
  background: 'var(--error-bg)',
  color: 'var(--error)',
  fontSize: '14px',
})

export const noticeStyle = css({
  margin: 0,
  padding: '10px 12px',
  borderRadius: '8px',
  background: 'var(--notice-bg)',
  color: 'var(--text-primary)',
  fontSize: '14px',
})

export const statusBoxStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  borderRadius: '12px',
  background: 'var(--surface-2)',
})

export const badgeStyle = css({
  marginLeft: '8px',
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  background: 'var(--brand-green)',
  color: '#ffffff',
})

export const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px',
  '& th, & td': {
    textAlign: 'left',
    padding: '8px 6px',
    borderBottom: '1px solid var(--border)',
  },
  '& th': {
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
})

export const inputStyle = css({
  appearance: 'none',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '14px',
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  background: 'var(--surface-1)',
  '&:focus-visible': {
    outline: '2px solid var(--brand-green)',
    outlineOffset: '-1px',
  },
})
