import { css, type Handle } from 'remix/ui'

import type { AuthorizedUser, Space } from '../data/schema.ts'
import type { AppUser } from '../middleware/auth.ts'
import { routes } from '../routes.ts'
import {
  AppShell,
  AvatarContent,
  badgeStyle,
  contentMutedTextStyle,
  contentTextStyle,
  contentTitleStyle,
  dangerButtonStyle,
  inputStyle,
  noticeStyle,
  primaryButtonStyle,
  rowStyle,
  secondaryButtonStyle,
  sectionStyle,
  tableStyle,
} from './app-shell.tsx'

export interface SettingsPageProps {
  user: AppUser
  space: Space | null
  authorizedUsers: AuthorizedUser[] | null
  message: string | null
  csrfToken: string
}

export function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    let { user, space, authorizedUsers, message, csrfToken } = handle.props

    return (
      <AppShell user={user} active="settings" title="Settings - Pacuare Reserve">
        <div mix={sectionStyle}>
          {message && <p mix={noticeStyle}>{message}</p>}

          <ProfileSection user={user} csrfToken={csrfToken} />

          {space && (space.status === 'ready' || space.status === 'error') && (
            <NotebookSection space={space} csrfToken={csrfToken} />
          )}

          {authorizedUsers && (
            <AdminSection admin={user} users={authorizedUsers} csrfToken={csrfToken} />
          )}
        </div>
      </AppShell>
    )
  }
}

function ProfileSection(handle: Handle<{ user: AppUser; csrfToken: string }>) {
  return () => {
    let { user, csrfToken } = handle.props
    return (
      <section mix={cardStyle}>
        <div mix={profileHeaderStyle}>
          <div mix={profileAvatarStyle}>
            <AvatarContent user={user} />
          </div>
          <div mix={profileInfoStyle}>
            <p mix={contentTitleStyle}>
              {user.name}
              {user.role === 'admin' && <span mix={badgeStyle}>admin</span>}
            </p>
            <p mix={contentMutedTextStyle}>{user.email}</p>
          </div>
        </div>
        <form method="post" action={routes.auth.logout.href()}>
          <input type="hidden" name="_csrf" value={csrfToken} />
          <button type="submit" mix={secondaryButtonStyle}>
            Sign out
          </button>
        </form>
      </section>
    )
  }
}

function NotebookSection(handle: Handle<{ space: Space; csrfToken: string }>) {
  return () => {
    let { space, csrfToken } = handle.props
    return (
      <section mix={cardStyle}>
        <p mix={contentTitleStyle}>Your notebook</p>
        <p mix={contentTextStyle}>
          {space.status === 'ready'
            ? 'Your notebook environment is ready.'
            : `Something went wrong setting up your notebook${space.last_error ? `: ${space.last_error}` : '.'}`}
        </p>
        {space.status === 'ready' && (
          <p mix={contentMutedTextStyle}>
            "Update" re-pulls the latest marimo/system image and restarts your notebook's container.
            Your notebook code and data live on a separate volume and aren't touched.
          </p>
        )}
        <div mix={rowStyle}>
          {space.status === 'ready' && (
            <form method="post" action={routes.notebook.update.href()}>
              <input type="hidden" name="_csrf" value={csrfToken} />
              <button type="submit" mix={secondaryButtonStyle}>
                Update
              </button>
            </form>
          )}
          <form method="post" action={routes.notebook.reset.href()}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <button type="submit" mix={secondaryButtonStyle}>
              Reset
            </button>
          </form>
          <form method="post" action={routes.notebook.destroy.href()}>
            <input type="hidden" name="_csrf" value={csrfToken} />
            <button type="submit" mix={dangerButtonStyle}>
              Delete
            </button>
          </form>
        </div>
      </section>
    )
  }
}

function AdminSection(
  handle: Handle<{ admin: AppUser; users: AuthorizedUser[]; csrfToken: string }>,
) {
  return () => {
    let { admin, users, csrfToken } = handle.props
    return (
      <section mix={cardStyle}>
        <p mix={contentTitleStyle}>Authorized users</p>
        <p mix={contentMutedTextStyle}>
          Anyone signing in with Google must have an entry here. Admins can manage this list.
        </p>

        <AddUserForm csrfToken={csrfToken} />

        <table mix={tableStyle}>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Added by</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((authorizedUser) => (
              <UserRow
                user={authorizedUser}
                isSelf={authorizedUser.email === admin.email}
                csrfToken={csrfToken}
              />
            ))}
          </tbody>
        </table>
      </section>
    )
  }
}

function AddUserForm(handle: Handle<{ csrfToken: string }>) {
  return () => (
    <form method="post" action={routes.admin.addUser.href()} mix={rowStyle}>
      <input type="hidden" name="_csrf" value={handle.props.csrfToken} />
      <input type="email" name="email" placeholder="name@example.com" required mix={inputStyle} />
      <select name="role" mix={inputStyle}>
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit" mix={primaryButtonStyle}>
        Add
      </button>
    </form>
  )
}

function UserRow(handle: Handle<{ user: AuthorizedUser; isSelf: boolean; csrfToken: string }>) {
  return () => {
    let { user, isSelf, csrfToken } = handle.props
    let otherRole = user.role === 'admin' ? 'member' : 'admin'

    return (
      <tr>
        <td>
          {user.email}
          {isSelf && ' (you)'}
        </td>
        <td>{user.role}</td>
        <td>{user.added_by ?? '—'}</td>
        <td>
          <div mix={rowStyle}>
            <form method="post" action={routes.admin.setRole.href({ email: user.email })}>
              <input type="hidden" name="_csrf" value={csrfToken} />
              <input type="hidden" name="role" value={otherRole} />
              <button type="submit" mix={secondaryButtonStyle}>
                Make {otherRole}
              </button>
            </form>
            {!isSelf && (
              <form method="post" action={routes.admin.removeUser.href({ email: user.email })}>
                <input type="hidden" name="_csrf" value={csrfToken} />
                <button type="submit" mix={dangerButtonStyle}>
                  Remove
                </button>
              </form>
            )}
          </div>
        </td>
      </tr>
    )
  }
}

const cardStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  paddingBottom: '24px',
  borderBottom: '1px solid #dde2e7',
  '&:last-child': { borderBottom: 0, paddingBottom: 0 },
})

const profileHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
})

const profileAvatarStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '56px',
  height: '56px',
  flexShrink: 0,
  borderRadius: '9999px',
  overflow: 'hidden',
  background: '#16323C',
  color: '#FFFFFF',
  fontSize: '20px',
})

const profileInfoStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
})
