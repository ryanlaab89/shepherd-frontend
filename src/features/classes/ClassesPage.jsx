import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { CLASSES_QUERY } from '@/graphql/queries'
import {
  CREATE_CLASS_MUTATION, UPDATE_CLASS_MUTATION, DELETE_CLASS_MUTATION,
  ASSIGN_CHILD_TO_CLASS_MUTATION,
} from '@/graphql/mutations'

export default function ClassesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)

  const { data, loading } = useQuery(CLASSES_QUERY)
  const classes = data?.classes ?? []

  function openNew()      { setEditing(null); setShowForm(true) }
  function openEdit(cls)  { setEditing(cls);  setShowForm(true) }
  function closeForm()    { setShowForm(false); setEditing(null) }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Classes</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Manage classes, assign teachers, and place children
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-sm font-semibold flex-shrink-0 whitespace-nowrap
            hover:bg-[var(--primary)]/90 active:scale-95 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Class
        </button>
      </div>

      {showForm && (
        <ClassFormModal editing={editing} onClose={closeForm} />
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : classes.length === 0 ? (
        <EmptyState onNew={openNew} />
      ) : (
        <div className="space-y-4">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} onEdit={() => openEdit(cls)} />
          ))}
        </div>
      )}
    </div>
  )
}

function ClassCard({ cls, onEdit }) {
  const [section, setSection] = useState(null) // 'teachers' | 'children' | null

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-[var(--foreground)]">{cls.name}</h2>
            {(cls.min_age != null || cls.max_age != null) && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
                {cls.min_age != null && cls.max_age != null
                  ? `Ages ${cls.min_age}–${cls.max_age}`
                  : cls.min_age != null
                    ? `${cls.min_age}+`
                    : `Up to ${cls.max_age}`}
              </span>
            )}
          </div>
          {cls.description && (
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{cls.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            <button onClick={() => setSection(s => s === 'children' ? null : 'children')}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors">
              {cls.people.length} children
            </button>
          </div>
        </div>
        <button onClick={onEdit}
          className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      {section === 'children' && <ChildrenPanel cls={cls} />}
    </div>
  )
}


function ChildrenPanel({ cls }) {
  const [assignChild] = useMutation(ASSIGN_CHILD_TO_CLASS_MUTATION, {
    refetchQueries: [{ query: CLASSES_QUERY }],
  })

  return (
    <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 p-4 space-y-3">
      <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Children</p>

      {cls.people.length === 0 ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          No children assigned. Class assignment happens during registration or check-in.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {cls.people.map(p => (
            <div key={p.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg
                bg-[var(--background)] border border-[var(--border)] text-xs">
              <span className="text-[var(--foreground)]">{p.first_name} {p.last_name}</span>
              <button
                onClick={() => assignChild({ variables: { personId: p.id, classId: null } })}
                title="Remove from class"
                className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors ml-2">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClassFormModal({ editing, onClose }) {
  const [form, setForm]   = useState({
    name:        editing?.name        ?? '',
    min_age:     editing?.min_age     ?? '',
    max_age:     editing?.max_age     ?? '',
    description: editing?.description ?? '',
  })
  const [error, setError] = useState('')

  const [createClass, { loading: creating }] = useMutation(CREATE_CLASS_MUTATION, {
    refetchQueries: [{ query: CLASSES_QUERY }],
    onCompleted: onClose,
  })
  const [updateClass, { loading: updating }] = useMutation(UPDATE_CLASS_MUTATION, {
    refetchQueries: [{ query: CLASSES_QUERY }],
    onCompleted: onClose,
  })
  const [deleteClass, { loading: deleting }] = useMutation(DELETE_CLASS_MUTATION, {
    refetchQueries: [{ query: CLASSES_QUERY }],
    onCompleted: onClose,
  })

  const saving = creating || updating

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const input = {
      name:        form.name.trim(),
      min_age:     form.min_age !== '' ? parseInt(form.min_age) : null,
      max_age:     form.max_age !== '' ? parseInt(form.max_age) : null,
      description: form.description.trim() || null,
    }
    try {
      if (editing) {
        await updateClass({ variables: { id: editing.id, input } })
      } else {
        await createClass({ variables: { input } })
      }
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${editing.name}"? This cannot be undone.`)) return
    try {
      await deleteClass({ variables: { id: editing.id } })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--foreground)]">
            {editing ? 'Edit Class' : 'New Class'}
          </h2>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Class Name *">
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputClass} placeholder="Kids" autoFocus />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min Age">
              <input type="number" min="0" max="30" value={form.min_age}
                onChange={e => setForm(f => ({ ...f, min_age: e.target.value }))}
                className={inputClass} placeholder="6" />
            </Field>
            <Field label="Max Age">
              <input type="number" min="0" max="30" value={form.max_age}
                onChange={e => setForm(f => ({ ...f, max_age: e.target.value }))}
                className={inputClass} placeholder="11" />
            </Field>
          </div>

          <Field label="Description">
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className={inputClass} placeholder="Optional note for staff" />
          </Field>

          <div className="flex gap-2 pt-2">
            {editing && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-4 py-2.5 rounded-lg border border-[var(--destructive)]/40 text-[var(--destructive)]
                  text-sm hover:bg-[var(--destructive)]/10 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[var(--border)]
                text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmptyState({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-[var(--border)]">
      <svg className="w-10 h-10 mb-3 text-[var(--muted-foreground)] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p className="text-sm font-medium text-[var(--foreground)]">No classes yet</p>
      <p className="text-xs text-[var(--muted-foreground)] mt-1 mb-4">Create your first class to get started</p>
      <button onClick={onNew}
        className="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-semibold
          hover:bg-[var(--primary)]/90 transition-colors">
        Create First Class
      </button>
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

function Spinner() {
  return (
    <svg className="animate-spin w-6 h-6 text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const inputClass = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`

