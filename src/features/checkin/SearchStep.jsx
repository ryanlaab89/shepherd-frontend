import { useState, useEffect, useRef } from 'react'
import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import { SEARCH_CHILDREN_QUERY, CLASSES_QUERY } from '@/graphql/queries'
import { REGISTER_CHILD_MUTATION, UPDATE_PERSON_MUTATION } from '@/graphql/mutations'

function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  const now   = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

// onSelectPerson(person, guardianName?, guardianPhone?) — extra args supplied for new registrations
export default function SearchStep({ onSelectPerson }) {
  const [query, setQuery]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const debounceRef = useRef(null)

  const [search, { data, loading, called }] = useLazyQuery(SEARCH_CHILDREN_QUERY)
  const [registerChild, { loading: registering }] = useMutation(REGISTER_CHILD_MUTATION)

  const [results, setResults] = useState([])
  const [editId, setEditId] = useState(null)

  const searched = called && !loading

  // Sync results from query, but also allow local updates after inline edit
  useEffect(() => {
    if (data?.searchChildren) setResults(data.searchChildren)
  }, [data])

  // Debounced auto-search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    setShowForm(false)
    setEditId(null)
    if (query.trim().length < 2) return
    debounceRef.current = setTimeout(() => {
      search({ variables: { query: query.trim() } })
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  function handleSearch(e) {
    e.preventDefault()
    if (query.trim().length < 2) return
    clearTimeout(debounceRef.current)
    setEditId(null)
    search({ variables: { query: query.trim() } })
  }

  function handlePersonUpdated(updated) {
    setResults(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
    setEditId(null)
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Child's first or last name…"
          className={inputClass + ' flex-1'}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          className="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold
            hover:bg-[var(--primary)]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--muted-foreground)]">
            {results.length} child{results.length !== 1 ? 'ren' : ''} found
          </p>
          {results.map((person) => {
            const age = calcAge(person.date_of_birth)
            return (
            <div key={person.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              {/* Result row */}
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => onSelectPerson(person)}
                  className="flex-1 text-left min-w-0 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                      flex-shrink-0 text-sm font-bold text-[var(--primary)]">
                      {person.first_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                          {person.first_name} {person.last_name}
                        </p>
                        {age !== null && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                            bg-[var(--muted)] text-[var(--muted-foreground)] flex-shrink-0">
                            {age} yrs
                          </span>
                        )}
                        {person.classGroup && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                            bg-[var(--primary)]/10 text-[var(--primary)] flex-shrink-0">
                            {person.classGroup.name}
                          </span>
                        )}
                        {person.activeCheckin && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                            bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex-shrink-0">
                            Already in
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] truncate">
                        {person.household.last_name} family
                        {person.household.phone ? ` · ${person.household.phone}` : ''}
                        {person.date_of_birth ? ` · b. ${new Date(person.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                      </p>
                      {person.activeCheckin && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          {person.activeCheckin.service.name}
                        </p>
                      )}
                    </div>
                  </div>
                </button>

                {/* Edit / chevron */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setEditId(editId === person.id ? null : person.id)}
                    className={`p-1.5 rounded-lg transition-colors
                      ${editId === person.id
                        ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                        : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'}`}
                    title="Edit child"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onSelectPerson(person)}
                    className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors p-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Inline edit form */}
              {editId === person.id && (
                <InlineEditForm
                  person={person}
                  onDone={handlePersonUpdated}
                  onCancel={() => setEditId(null)}
                />
              )}
            </div>
            )
          })}

          {/* Register option when results exist but child not listed */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2.5 rounded-lg border border-dashed border-[var(--border)]
                text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)]
                hover:text-[var(--primary)] transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Not listed? Register a new child
            </button>
          )}
        </div>
      )}

      {/* No results state */}
      {searched && results.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center space-y-3">
          <p className="text-sm text-[var(--foreground)] font-medium">
            No results for <span className="text-[var(--primary)]">"{query}"</span>
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">First time here? Register a new child below.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--primary)]
              text-[var(--primary-foreground)] text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Register Child
          </button>
        </div>
      )}

      {/* Inline registration form */}
      {showForm && (
        <InlineRegisterForm
          prefillFirstName={query.trim()}
          onDone={onSelectPerson}
          onCancel={() => setShowForm(false)}
          registerChild={registerChild}
          loading={registering}
        />
      )}
    </div>
  )
}

function InlineEditForm({ person, onDone, onCancel }) {
  const { data: classesData } = useQuery(CLASSES_QUERY)
  const classes = classesData?.classes ?? []

  const [updatePerson, { loading }] = useMutation(UPDATE_PERSON_MUTATION)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    first_name:    person.first_name,
    last_name:     person.last_name,
    date_of_birth: person.date_of_birth ?? '',
    medical_notes: person.medical_notes ?? '',
    class_id:      person.classGroup?.id ?? '',
  })

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await updatePerson({
        variables: {
          personId: person.id,
          input: {
            first_name:    form.first_name.trim(),
            last_name:     form.last_name.trim() || undefined,
            date_of_birth: form.date_of_birth    || undefined,
            medical_notes: form.medical_notes.trim() || undefined,
            class_id:      form.class_id         || undefined,
          },
        },
      })
      onDone(data.updatePerson)
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.')
    }
  }

  return (
    <div className="border-t border-[var(--border)] px-4 py-4 bg-[var(--muted)]/30">
      <p className="text-xs font-semibold text-[var(--foreground)] mb-3">Edit Child</p>
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="First Name">
            <input required value={form.first_name} onChange={set('first_name')} className={inputClass} autoFocus />
          </Field>
          <Field label="Last Name">
            <input value={form.last_name} onChange={set('last_name')} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date of Birth">
            <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')}
              className={inputClass} max={new Date().toISOString().split('T')[0]} />
          </Field>
          {classes.length > 0 && (
            <Field label="Class">
              <select value={form.class_id} onChange={set('class_id')} className={inputClass}>
                <option value="">Not assigned</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.min_age != null || c.max_age != null
                      ? ` (${c.min_age ?? ''}–${c.max_age ?? ''})`
                      : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="Allergies / Medical Notes">
          <textarea value={form.medical_notes} onChange={set('medical_notes')}
            rows={2} className={inputClass + ' resize-none'}
            placeholder="e.g. Peanut allergy, uses inhaler…" />
        </Field>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm
              text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
              text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60">
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function InlineRegisterForm({ prefillFirstName, onDone, onCancel, registerChild, loading }) {
  const { data: classesData } = useQuery(CLASSES_QUERY)
  const classes = classesData?.classes ?? []

  const [form, setForm] = useState({
    child_first_name:   prefillFirstName,
    guardian_last_name: '',
    guardian_phone:     '',
    guardian_name:      '',
    class_id:           '',
    // optional
    guardian_email:     '',
    child_last_name:    '',
    date_of_birth:      '',
    medical_notes:      '',
  })
  const [showOptional, setShowOptional] = useState(false)
  const [error, setError] = useState('')

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const { data } = await registerChild({
        variables: {
          input: {
            child_first_name:   form.child_first_name.trim(),
            guardian_last_name: form.guardian_last_name.trim(),
            guardian_phone:     form.guardian_phone.trim(),
            class_id:           form.class_id || undefined,
            guardian_email:     form.guardian_email.trim()  || undefined,
            child_last_name:    form.child_last_name.trim() || undefined,
            date_of_birth:      form.date_of_birth          || undefined,
            medical_notes:      form.medical_notes.trim()   || undefined,
          },
        },
      })
      onDone(
        data.registerChild,
        form.guardian_name.trim()  || undefined,
        form.guardian_phone.trim() || undefined,
      )
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.')
    }
  }

  return (
    <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/3 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--foreground)]">New Child</p>
        <button onClick={onCancel}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Required fields */}
        <Field label="Child's First Name *">
          <input required value={form.child_first_name} onChange={set('child_first_name')}
            className={inputClass} placeholder="Emma" autoFocus />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Last Name *">
            <input required value={form.guardian_last_name} onChange={set('guardian_last_name')}
              className={inputClass} placeholder="Smith" />
          </Field>
          <Field label="Guardian Phone *">
            <input required type="tel" value={form.guardian_phone} onChange={set('guardian_phone')}
              className={inputClass} placeholder="555-1234" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Guardian Name">
            <input value={form.guardian_name} onChange={set('guardian_name')}
              className={inputClass} placeholder="e.g. Grandma Ruth, Dad" autoComplete="off" />
          </Field>
          <Field label="Date of Birth">
            <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')}
              className={inputClass} max={new Date().toISOString().split('T')[0]} />
          </Field>
        </div>

        {classes.length > 0 && (
          <Field label="Class">
            <select value={form.class_id} onChange={set('class_id')} className={inputClass}>
              <option value="">Not assigned yet</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.min_age != null || c.max_age != null
                    ? ` (${c.min_age != null ? c.min_age : ''}–${c.max_age != null ? c.max_age : ''})`
                    : ''}
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* Optional toggle */}
        <div>
          <button type="button" onClick={() => setShowOptional(v => !v)}
            className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]
              hover:text-[var(--foreground)] transition-colors">
            <svg className={`w-3.5 h-3.5 transition-transform ${showOptional ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showOptional ? 'Hide optional fields' : 'Add optional details'}
          </button>

          {showOptional && (
            <div className="mt-3 space-y-3 pl-3 border-l-2 border-[var(--border)]">
              <Field label="Parent Email">
                <input type="email" value={form.guardian_email} onChange={set('guardian_email')}
                  className={inputClass} placeholder="family@email.com" />
              </Field>
              <Field label="Child Last Name">
                <input value={form.child_last_name} onChange={set('child_last_name')}
                  className={inputClass} placeholder={form.guardian_last_name || 'Smith'} />
              </Field>
              <Field label="Allergies / Medical Notes">
                <textarea value={form.medical_notes} onChange={set('medical_notes')}
                  rows={2} className={inputClass + ' resize-none'}
                  placeholder="e.g. Peanut allergy, uses inhaler…" />
              </Field>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-[var(--border)] text-sm
              text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
              text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60">
            {loading ? 'Saving…' : 'Save & Select Service →'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--foreground)] mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputClass = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`
