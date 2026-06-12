import { useState } from 'react'
import { useMutation } from '@apollo/client'
import { UPDATE_PROFILE_MUTATION } from '@/graphql/mutations'
import { useAuth } from '@/features/auth/AuthContext'
import { useTheme } from '@/features/theme/ThemeContext'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [updateProfile] = useMutation(UPDATE_PROFILE_MUTATION)

  // Contact info form
  const [info, setInfo] = useState({
    name:  user?.name  ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  })
  const [infoError,   setInfoError]   = useState('')
  const [infoSuccess, setInfoSuccess] = useState(false)
  const [infoSaving,  setInfoSaving]  = useState(false)

  // Password form
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwError,   setPwError]   = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSaving,  setPwSaving]  = useState(false)

  function setInfoField(field) {
    return (e) => { setInfo(f => ({ ...f, [field]: e.target.value })); setInfoSuccess(false) }
  }

  function setPwField(field) {
    return (e) => { setPw(f => ({ ...f, [field]: e.target.value })); setPwSuccess(false) }
  }

  async function handleSaveInfo(e) {
    e.preventDefault()
    setInfoError('')
    setInfoSuccess(false)
    setInfoSaving(true)
    try {
      const { data } = await updateProfile({
        variables: {
          input: {
            name:  info.name.trim(),
            email: info.email.trim(),
            phone: info.phone.trim() || null,
          },
        },
      })
      updateUser(data.updateProfile)
      setInfoSuccess(true)
    } catch (err) {
      setInfoError(err.message || 'Could not save. Please try again.')
    } finally {
      setInfoSaving(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (pw.new_password !== pw.confirm) {
      setPwError('New passwords do not match.')
      return
    }
    if (pw.new_password.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    setPwSaving(true)
    try {
      await updateProfile({
        variables: {
          input: {
            current_password: pw.current_password,
            new_password:     pw.new_password,
          },
        },
      })
      setPw({ current_password: '', new_password: '', confirm: '' })
      setPwSuccess(true)
    } catch (err) {
      setPwError(err.message || 'Could not update password. Please try again.')
    } finally {
      setPwSaving(false)
    }
  }

  const roleName = { ADMIN: 'Admin', TEACHER: 'Teacher', VOLUNTEER: 'Volunteer' }

  return (
    <div className="p-4 sm:p-8 max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">My Account</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Update your contact details or change your password
        </p>
      </div>

      {/* Avatar + role chip */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
          text-xl font-bold text-[var(--primary)] flex-shrink-0">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-[var(--foreground)]">{user?.name}</p>
          <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium mt-0.5 ${roleBadgeClass(user?.role)}`}>
            {roleName[user?.role] ?? user?.role}
          </span>
        </div>
      </div>

      {/* Appearance */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Appearance</h2>
        </div>
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {theme === 'dark' ? 'Dark mode' : 'Light mode'}
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Saved to this device
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2
              ${theme === 'dark' ? 'bg-[var(--primary)]' : 'bg-[var(--muted-foreground)]/30'}`}
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Toggle dark mode"
          >
            <span className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-1
              ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </section>

      {/* Contact info */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Contact Info</h2>
        </div>
        <div className="p-5">
          {infoError && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">
              {infoError}
            </div>
          )}
          {infoSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
              Changes saved.
            </div>
          )}
          <form onSubmit={handleSaveInfo} className="space-y-4">
            <Field label="Full Name">
              <input required value={info.name} onChange={setInfoField('name')} className={inputClass} />
            </Field>
            <Field label="Email">
              <input required type="email" value={info.email} onChange={setInfoField('email')} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input type="tel" value={info.phone} onChange={setInfoField('phone')}
                className={inputClass} placeholder="e.g. 555-0100" />
            </Field>
            <button type="submit" disabled={infoSaving}
              className="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60">
              {infoSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      </section>

      {/* Change password */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Change Password</h2>
        </div>
        <div className="p-5">
          {pwError && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
              Password updated.
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Field label="Current Password">
              <input required type="password" value={pw.current_password}
                onChange={setPwField('current_password')} className={inputClass}
                autoComplete="current-password" placeholder="••••••••" />
            </Field>
            <Field label="New Password">
              <input required type="password" value={pw.new_password}
                onChange={setPwField('new_password')} className={inputClass}
                autoComplete="new-password" placeholder="Min. 8 characters" minLength={8} />
            </Field>
            <Field label="Confirm New Password">
              <input required type="password" value={pw.confirm}
                onChange={setPwField('confirm')} className={inputClass}
                autoComplete="new-password" placeholder="••••••••" />
            </Field>
            <button type="submit" disabled={pwSaving}
              className="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60">
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

function roleBadgeClass(role) {
  return {
    ADMIN:     'bg-[var(--primary)]/10 text-[var(--primary)]',
    TEACHER:   'bg-emerald-100 text-emerald-700',
    VOLUNTEER: 'bg-[var(--muted)] text-[var(--muted-foreground)]',
  }[role] ?? 'bg-[var(--muted)] text-[var(--muted-foreground)]'
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputClass = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`
