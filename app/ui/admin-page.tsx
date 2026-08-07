import type { Handle } from 'remix/ui'

import type { AuthorizedUser } from '../data/schema.ts'
import type { AppUser } from '../middleware/auth.ts'
import { routes } from '../routes.ts'
import {
  buttonStyle,
  dangerLinkButtonStyle,
  inputStyle,
  leadStyle,
  linkButtonStyle,
  noticeStyle,
  PageShell,
  rowStyle,
  tableStyle,
  titleStyle,
} from './page-shell.tsx'

export interface AdminPageProps {
  admin: AppUser
  users: AuthorizedUser[]
  message: string | null
  csrfToken: string
}

export function AdminPage(handle: Handle<AdminPageProps>) {
  return () => {
    let { admin, users, message, csrfToken } = handle.props

    return (
      <PageShell title="Authorized users - Pacuare Reserve" wide>
        <h1 mix={titleStyle}>Authorized users</h1>
        <p mix={leadStyle}>
          Anyone signing in with Google must have an entry here. Admins can manage this list.
        </p>
        {message && <p mix={noticeStyle}>{message}</p>}

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

        <div mix={rowStyle}>
          <a href={routes.home.href()} mix={linkButtonStyle}>
            Back home
          </a>
        </div>
      </PageShell>
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
      <button type="submit" mix={buttonStyle}>
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
              <button type="submit" mix={linkButtonStyle}>
                Make {otherRole}
              </button>
            </form>
            {!isSelf && (
              <form method="post" action={routes.admin.removeUser.href({ email: user.email })}>
                <input type="hidden" name="_csrf" value={csrfToken} />
                <button type="submit" mix={dangerLinkButtonStyle}>
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
