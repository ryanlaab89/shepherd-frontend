import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { API_BASE as API } from '@/lib/apiUrl'
import { isStrongPassword } from '@/lib/validators'

function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '', color: '' }
  const hasLength  = password.length >= 8
  const hasLetter  = /[a-zA-Z]/.test(password)
  const hasNumber  = /[0-9]/.test(password)
  const hasExtra   = password.length >= 12 || /[^a-zA-Z0-9]/.test(password)
  const score = [hasLength, hasLetter, hasNumber, hasExtra].filter(Boolean).length
  if (score <= 1) return { level: 1, label: 'Weak',   color: 'bg-red-500',     text: 'text-red-500' }
  if (score === 2) return { level: 2, label: 'Fair',   color: 'bg-amber-500',   text: 'text-amber-500' }
  if (score === 3) return { level: 3, label: 'Good',   color: 'bg-emerald-500', text: 'text-emerald-500' }
  return             { level: 4, label: 'Strong', color: 'bg-emerald-600', text: 'text-emerald-600' }
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [tab, setTab]       = useState('login')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    church_name: '', name: '', email: '', password: '', password_confirmation: '',
  })

  const firstInputRef = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => firstInputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [tab])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Login failed. Check your email and password.')
      } else {
        login(data.token, data.user)
        navigate('/dashboard')
      }
    } catch {
      setError('Unable to reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (!isStrongPassword(registerForm.password)) {
      setError('Password must be at least 8 characters and include a letter and a number.')
      return
    }
    if (registerForm.password !== registerForm.password_confirmation) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      })
      const data = await res.json()
      if (!res.ok) {
        const msgs = data.errors
          ? Object.values(data.errors).flat().join(' ')
          : data.message || 'Registration failed.'
        setError(msgs)
      } else {
        login(data.token, data.user)
        navigate('/dashboard')
      }
    } catch {
      setError('Unable to reach the server. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const strength = getPasswordStrength(registerForm.password)
  const confirmMatch = registerForm.password_confirmation &&
    registerForm.password === registerForm.password_confirmation

  return (
    <div className="min-h-screen flex items-center justify-center px-4
      bg-gradient-to-br from-[var(--background)] via-[var(--background)] to-[var(--muted)]/40">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
            bg-[var(--primary)] shadow-lg shadow-[var(--primary)]/20 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Shepherd</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Kids Ministry Check-In</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)]">
            {[
              { key: 'login',    label: 'Sign In' },
              { key: 'register', label: 'Register' },
            ].map(({ key, label }) => (
              <button key={key}
                onClick={() => { setTab(key); setError('') }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] -mb-px'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Error banner */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-[var(--destructive)]/10
                border border-[var(--destructive)]/20 flex items-start gap-2.5">
                <svg className="w-4 h-4 text-[var(--destructive)] flex-shrink-0 mt-0.5"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-[var(--destructive)]">{error}</p>
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="Email">
                  <input ref={firstInputRef}
                    type="email" required autoComplete="email"
                    value={loginForm.email}
                    onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                    className={inputClass}
                    placeholder="you@church.org"
                  />
                </Field>
                <Field label="Password">
                  <PasswordInput
                    value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    autoComplete="current-password"
                  />
                </Field>
                <SubmitButton loading={loading}>Sign In</SubmitButton>
              </form>
            ) : (
              <>
                <p className="text-xs text-[var(--muted-foreground)] mb-5 leading-relaxed">
                  One account per church. You'll be set up as the admin and can add
                  staff and volunteers after signing in.
                </p>
                <form onSubmit={handleRegister} className="space-y-4">
                  <Field label="Church Name">
                    <input ref={firstInputRef}
                      type="text" required
                      value={registerForm.church_name}
                      onChange={e => setRegisterForm(f => ({ ...f, church_name: e.target.value }))}
                      className={inputClass}
                      placeholder="Grace Community Church"
                    />
                  </Field>
                  <Field label="Your Name">
                    <input
                      type="text" required
                      value={registerForm.name}
                      onChange={e => setRegisterForm(f => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                      placeholder="Pastor or admin name"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email" required
                      value={registerForm.email}
                      onChange={e => setRegisterForm(f => ({ ...f, email: e.target.value }))}
                      className={inputClass}
                      placeholder="admin@church.org"
                    />
                  </Field>
                  <Field label="Password">
                    <PasswordInput
                      value={registerForm.password}
                      onChange={e => setRegisterForm(f => ({ ...f, password: e.target.value }))}
                      autoComplete="new-password"
                    />
                    {/* Strength meter */}
                    {registerForm.password && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i}
                              className={`h-1 flex-1 rounded-full transition-colors ${
                                i <= strength.level ? strength.color : 'bg-[var(--border)]'
                              }`} />
                          ))}
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                          {strength.level < 3 && (
                            <span> — needs 8+ chars, a letter, and a number</span>
                          )}
                        </p>
                      </div>
                    )}
                  </Field>
                  <Field label="Confirm Password">
                    <PasswordInput
                      value={registerForm.password_confirmation}
                      onChange={e => setRegisterForm(f => ({ ...f, password_confirmation: e.target.value }))}
                      autoComplete="new-password"
                    />
                    {registerForm.password_confirmation && (
                      <p className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium ${
                        confirmMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                      }`}>
                        {confirmMatch ? (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Passwords match
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Passwords do not match
                          </>
                        )}
                      </p>
                    )}
                  </Field>
                  <SubmitButton loading={loading}>Create Church Account</SubmitButton>
                  <p className="text-xs text-center text-[var(--muted-foreground)] leading-relaxed">
                    By creating an account, you agree to our{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-[var(--foreground)] transition-colors">
                      Terms of Service
                    </a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-[var(--foreground)] transition-colors">
                      Privacy Policy
                    </a>.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PasswordInput({ value, onChange, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        className={inputClass + ' pr-10'}
        placeholder="••••••••"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]
          hover:text-[var(--foreground)] transition-colors"
        aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SubmitButton({ loading, children }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-2.5 px-4 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
        text-sm font-semibold hover:bg-[var(--primary)]/90 active:scale-[0.98] transition-all
        disabled:opacity-60 disabled:cursor-not-allowed mt-2 shadow-sm shadow-[var(--primary)]/20">
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner /> Processing…
        </span>
      ) : children}
    </button>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const inputClass = `w-full px-3 py-2.5 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)]
  transition-colors`
