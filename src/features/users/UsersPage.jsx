import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { USERS_QUERY } from '@/graphql/queries'
import {
  CREATE_USER_MUTATION,
  UPDATE_USER_ROLE_MUTATION,
  UPDATE_USER_MUTATION,
  RESET_PASSWORD_MUTATION,
  SET_USER_ACTIVE_MUTATION,
  DELETE_USER_MUTATION,
} from '@/graphql/mutations'
import { useAuth } from '@/features/auth/AuthContext'

export default function UsersPage() {
  const { user: me } = useAuth()
  const { data, loading, refetch } = useQuery(USERS_QUERY)
  const [createUser]    = useMutation(CREATE_USER_MUTATION,    { onCompleted: () => refetch() })
  const [updateRole]    = useMutation(UPDATE_USER_ROLE_MUTATION, { onCompleted: () => refetch() })
  const [updateUser]    = useMutation(UPDATE_USER_MUTATION,    { onCompleted: () => refetch() })
  const [resetPassword] = useMutation(RESET_PASSWORD_MUTATION)
  const [setUserActive] = useMutation(SET_USER_ACTIVE_MUTATION, { onCompleted: () => refetch() })
  const [deleteUser]    = useMutation(DELETE_USER_MUTATION,    { onCompleted: () => refetch() })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'VOLUNTEER' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // edit state: { userId, name, email, newPassword, pwError, saving }
  const [editId, setEditId]   = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', newPassword: '' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const users = data?.users ?? []

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function openEdit(u) {
    setEditId(u.id)
    setEditForm({ name: u.name, email: u.email, newPassword: '' })
    setEditError('')
  }

  function closeEdit() {
    setEditId(null)
    setEditError('')
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await createUser({ variables: { input: form } })
      setForm({ name: '', email: '', password: '', role: 'VOLUNTEER' })
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await updateRole({ variables: { userId, role: newRole } })
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setEditError('')
    setEditSaving(true)
    try {
      await updateUser({
        variables: {
          userId: editId,
          input: { name: editForm.name.trim(), email: editForm.email.trim() },
        },
      })
      if (editForm.newPassword.trim()) {
        if (editForm.newPassword.length < 8) {
          setEditError('New password must be at least 8 characters.')
          setEditSaving(false)
          return
        }
        await resetPassword({ variables: { userId: editId, password: editForm.newPassword } })
      }
      closeEdit()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleToggleActive(u) {
    const action = u.is_active ? 'disable' : 'enable'
    if (!confirm(`${action === 'disable' ? 'Disable' : 'Re-enable'} ${u.name}'s account?`)) return
    try {
      await setUserActive({ variables: { userId: u.id, active: !u.is_active } })
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete(userId, name) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return
    try {
      await deleteUser({ variables: { userId } })
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Staff</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Manage who can access Shepherd and what they can do
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-sm font-semibold flex-shrink-0 whitespace-nowrap
            hover:bg-[var(--primary)]/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Staff
        </button>
      </div>

      {/* Add user form */}
      {showForm && (
        <div className="mb-6 p-5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5">
          <p className="font-semibold text-[var(--foreground)] mb-4">New Staff Member</p>
          {error && (
            <div className="mb-3 p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full Name">
                <input required value={form.name} onChange={set('name')}
                  className={input} placeholder="Jane Smith" autoFocus />
              </Field>
              <Field label="Email">
                <input required type="email" value={form.email} onChange={set('email')}
                  className={input} placeholder="jane@church.org" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Password">
                <input required type="password" value={form.password} onChange={set('password')}
                  className={input} placeholder="Min. 8 characters" minLength={8} />
              </Field>
              <Field label="Role">
                <select value={form.role} onChange={set('role')} className={input}>
                  <option value="VOLUNTEER">Volunteer — check-in only</option>
                  <option value="TEACHER">Teacher — check-in + assigned to a class</option>
                  <option value="ADMIN">Admin — full access</option>
                </select>
              </Field>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm
                  text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                  text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60">
                {saving ? 'Saving…' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className={`rounded-xl border bg-[var(--card)] transition-colors
              ${u.is_active ? 'border-[var(--border)]' : 'border-[var(--border)] opacity-60'}`}>
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center
                  text-xs font-bold flex-shrink-0
                  ${u.is_active ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                  {u.name[0].toUpperCase()}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[var(--foreground)] text-sm">
                      {u.name}
                      {u.id === me?.id && (
                        <span className="ml-1.5 text-xs text-[var(--muted-foreground)]">(you)</span>
                      )}
                    </span>
                    {!u.is_active && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                        bg-[var(--muted)] text-[var(--muted-foreground)]">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] truncate">{u.email}</p>
                </div>

                {/* Role */}
                <div className="flex-shrink-0">
                  {u.id === me?.id ? (
                    <RoleBadge role={u.role} />
                  ) : (
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-[var(--border)]
                        bg-[var(--background)] text-[var(--foreground)] focus:outline-none
                        focus:ring-2 focus:ring-[var(--ring)]/50 cursor-pointer"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="TEACHER">Teacher</option>
                      <option value="VOLUNTEER">Volunteer</option>
                    </select>
                  )}
                </div>

                {/* Actions */}
                {u.id !== me?.id && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Edit */}
                    <button
                      onClick={() => editId === u.id ? closeEdit() : openEdit(u)}
                      className={`p-1.5 rounded-lg transition-colors
                        ${editId === u.id
                          ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                          : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'}`}
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {/* Disable / Enable */}
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={`p-1.5 rounded-lg transition-colors
                        ${u.is_active
                          ? 'text-[var(--muted-foreground)] hover:bg-amber-50 hover:text-amber-600'
                          : 'text-[var(--muted-foreground)] hover:bg-emerald-50 hover:text-emerald-600'}`}
                      title={u.is_active ? 'Disable account' : 'Enable account'}
                    >
                      {u.is_active ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      className="p-1.5 rounded-lg text-[var(--muted-foreground)]
                        hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)]
                        transition-colors"
                      title="Delete permanently"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Inline edit form */}
              {editId === u.id && (
                <div className="border-t border-[var(--border)] px-4 py-4 bg-[var(--muted)]/30 rounded-b-xl">
                  {editError && (
                    <div className="mb-3 p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">
                      {editError}
                    </div>
                  )}
                  <form onSubmit={handleSaveEdit} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Name">
                        <input required value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className={input} autoFocus />
                      </Field>
                      <Field label="Email">
                        <input required type="email" value={editForm.email}
                          onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                          className={input} />
                      </Field>
                    </div>
                    <Field label="New Password (leave blank to keep current)">
                      <input type="password" value={editForm.newPassword}
                        onChange={e => setEditForm(f => ({ ...f, newPassword: e.target.value }))}
                        className={input} placeholder="Min. 8 characters" minLength={8} />
                    </Field>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={closeEdit}
                        className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm
                          text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={editSaving}
                        className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                          text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60">
                        {editSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Role legend */}
      <div className="mt-6 p-4 rounded-xl bg-[var(--muted)] space-y-1.5">
        <p className="text-xs font-semibold text-[var(--foreground)] mb-2">Role Permissions</p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">Admin</span>
          {' '}— full access: check-in, check-out, dashboard, manage staff, manage services
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">Teacher</span>
          {' '}— check-in, check-out, assigned to a class
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">Volunteer</span>
          {' '}— check-in and check-out only
        </p>
      </div>
    </div>
  )
}

function RoleBadge({ role }) {
  const styles = {
    ADMIN:     'bg-[var(--primary)]/10 text-[var(--primary)]',
    TEACHER:   'bg-emerald-100 text-emerald-700',
    VOLUNTEER: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  }
  const labels = { ADMIN: 'Admin', TEACHER: 'Teacher', VOLUNTEER: 'Volunteer' }
  return (
    <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium ${styles[role] ?? styles.VOLUNTEER}`}>
      {labels[role] ?? role}
    </span>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-6 h-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const input = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`
