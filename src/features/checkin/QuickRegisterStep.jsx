import { useState } from 'react'
import { useMutation } from '@apollo/client'
import { REGISTER_CHILD_MUTATION, ADD_CHILD_MUTATION } from '@/graphql/mutations'

export default function QuickRegisterStep({ mode = 'new', household, prefillFirstName = '', onDone, onBack }) {
  const [form, setForm] = useState({
    guardian_last_name: '',
    guardian_phone: '',
    guardian_email: '',
    child_first_name: prefillFirstName,
    child_last_name: '',
    date_of_birth: '',
    medical_notes: '',
  })
  const [showOptional, setShowOptional] = useState(false)
  const [error, setError] = useState('')

  const [registerChild, { loading: registering }] = useMutation(REGISTER_CHILD_MUTATION)
  const [addChild,      { loading: adding      }] = useMutation(ADD_CHILD_MUTATION)
  const loading = registering || adding

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'new') {
        const { data } = await registerChild({
          variables: {
            input: {
              guardian_last_name: form.guardian_last_name.trim(),
              guardian_phone:     form.guardian_phone.trim(),
              guardian_email:     form.guardian_email.trim()   || undefined,
              child_first_name:   form.child_first_name.trim(),
              child_last_name:    form.child_last_name.trim()  || undefined,
              date_of_birth:      form.date_of_birth           || undefined,
              medical_notes:      form.medical_notes.trim()    || undefined,
            },
          },
        })
        onDone(data.registerChild)
      } else {
        const { data } = await addChild({
          variables: {
            householdId: household.id,
            input: {
              first_name:    form.child_first_name.trim(),
              last_name:     form.child_last_name.trim()  || undefined,
              date_of_birth: form.date_of_birth           || undefined,
              medical_notes: form.medical_notes.trim()    || undefined,
            },
          },
        })
        onDone(data.addChildToHousehold)
      }
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.')
    }
  }

  const isNew = mode === 'new'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <p className="font-semibold text-[var(--foreground)]">
            {isNew ? 'New Family' : `Add child to ${household?.last_name} family`}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">Required fields only — tap below to add more</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Required fields ── */}
        {isNew && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Family Last Name *">
              <input
                required
                value={form.guardian_last_name}
                onChange={e => {
                  const v = e.target.value
                  setForm(f => ({
                    ...f,
                    guardian_last_name: v,
                    child_last_name: f.child_last_name === f.guardian_last_name ? v : f.child_last_name,
                  }))
                }}
                className={input}
                placeholder="Smith"
                autoFocus
              />
            </Field>
            <Field label="Parent Phone *">
              <input
                required
                type="tel"
                value={form.guardian_phone}
                onChange={set('guardian_phone')}
                className={input}
                placeholder="555-1234"
              />
            </Field>
          </div>
        )}

        <Field label="Child First Name *">
          <input
            required
            value={form.child_first_name}
            onChange={set('child_first_name')}
            className={input}
            placeholder="Emma"
            autoFocus={!isNew}
          />
        </Field>

        {/* ── Optional fields ── */}
        <div>
          <button
            type="button"
            onClick={() => setShowOptional(v => !v)}
            className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]
              hover:text-[var(--foreground)] transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showOptional ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showOptional ? 'Hide optional fields' : 'Add optional details'}
          </button>

          {showOptional && (
            <div className="mt-3 space-y-3 pl-1 border-l-2 border-[var(--border)]">
              {isNew && (
                <Field label="Parent Email">
                  <input
                    type="email"
                    value={form.guardian_email}
                    onChange={set('guardian_email')}
                    className={input}
                    placeholder="family@email.com"
                  />
                </Field>
              )}
              <Field label="Child Last Name">
                <input
                  value={form.child_last_name}
                  onChange={set('child_last_name')}
                  className={input}
                  placeholder={isNew ? form.guardian_last_name || 'Smith' : household?.last_name}
                />
              </Field>
              <Field label="Date of Birth">
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={set('date_of_birth')}
                  className={input}
                  max={new Date().toISOString().split('T')[0]}
                />
              </Field>
              <Field label="Allergies / Medical Notes">
                <textarea
                  value={form.medical_notes}
                  onChange={set('medical_notes')}
                  rows={2}
                  className={input + ' resize-none'}
                  placeholder="e.g. Peanut allergy, uses inhaler…"
                />
              </Field>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]
            font-semibold text-sm hover:bg-[var(--primary)]/90 active:scale-[0.98]
            transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2"><Spinner /> Saving…</span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Save &amp; Continue to Check In
            </span>
          )}
        </button>
      </form>
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

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const input = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`
