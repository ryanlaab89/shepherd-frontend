import { useState, useMemo } from 'react'
import { useQuery, useMutation, useLazyQuery } from '@apollo/client'
import { CHILDREN_QUERY, CHILD_CHECKINS_QUERY, CLASSES_QUERY } from '@/graphql/queries'
import { UPDATE_PERSON_MUTATION, DELETE_CHILD_MUTATION } from '@/graphql/mutations'
import { useAuth } from '@/features/auth/AuthContext'

function age(dob) {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

function fmt(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]'

export default function ChildrenPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const { data, loading, refetch } = useQuery(CHILDREN_QUERY, { fetchPolicy: 'cache-and-network' })
  const { data: classData } = useQuery(CLASSES_QUERY)

  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [saveError, setSaveError] = useState('')

  const [loadCheckins, { data: checkinData, loading: checkinLoading }] = useLazyQuery(CHILD_CHECKINS_QUERY)

  const [updatePerson, { loading: saving }] = useMutation(UPDATE_PERSON_MUTATION)
  const [deleteChild, { loading: deleting }] = useMutation(DELETE_CHILD_MUTATION)

  const children = data?.children ?? []
  const classes = classData?.classes ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return children.filter(c => {
      const name = `${c.first_name} ${c.last_name}`.toLowerCase()
      const guardian = c.household?.last_name?.toLowerCase() ?? ''
      const matchSearch = !q || name.includes(q) || guardian.includes(q)
      const matchClass = !filterClass || c.classGroup?.id === filterClass
      return matchSearch && matchClass
    })
  }, [children, search, filterClass])

  function toggleExpand(id) {
    if (expandedId === id) {
      setExpandedId(null)
      setEditingId(null)
    } else {
      setExpandedId(id)
      setEditingId(null)
      loadCheckins({ variables: { personId: id } })
    }
  }

  function startEdit(child) {
    setEditingId(child.id)
    setEditForm({
      first_name: child.first_name,
      last_name: child.last_name,
      date_of_birth: child.date_of_birth ?? '',
      medical_notes: child.medical_notes ?? '',
      notes: child.notes ?? '',
      class_id: child.classGroup?.id ?? '',
    })
    setSaveError('')
  }

  async function handleSave(personId) {
    setSaveError('')
    try {
      await updatePerson({
        variables: {
          personId,
          input: {
            first_name: editForm.first_name,
            last_name: editForm.last_name,
            date_of_birth: editForm.date_of_birth || null,
            medical_notes: editForm.medical_notes || null,
            notes: editForm.notes || null,
            class_id: editForm.class_id || null,
          },
        },
      })
      setEditingId(null)
      refetch()
    } catch (e) {
      setSaveError(e.message)
    }
  }

  async function handleDelete(personId) {
    try {
      await deleteChild({ variables: { personId } })
      setConfirmDelete(null)
      setExpandedId(null)
      refetch()
    } catch (e) {
      alert(e.message)
    }
  }

  const checkins = checkinData?.childCheckins ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Children</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          {children.length} registered · click a row to view details
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or family…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={inputClass + ' sm:max-w-xs'}
        />
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className={inputClass + ' sm:max-w-[180px]'}
        >
          <option value="">All classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {(search || filterClass) && (
          <button
            onClick={() => { setSearch(''); setFilterClass('') }}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-[var(--muted-foreground)]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted-foreground)]">No children found.</div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Name</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden sm:table-cell">Age</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Class</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Family</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Last Visit</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted-foreground)]">Visits</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(child => {
                const isOpen = expandedId === child.id
                const isEditing = editingId === child.id
                const childAge = age(child.date_of_birth)

                return (
                  <>
                    <tr
                      key={child.id}
                      onClick={() => toggleExpand(child.id)}
                      className={`border-b border-[var(--border)] cursor-pointer transition-colors
                        ${isOpen
                          ? 'bg-[var(--primary)]/5'
                          : 'hover:bg-[var(--muted)]/40'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                            text-xs font-bold text-[var(--primary)] flex-shrink-0">
                            {child.first_name[0]}{child.last_name?.[0] ?? ''}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--foreground)]">
                              {child.first_name} {child.last_name}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)] sm:hidden">
                              {childAge != null ? `${childAge}y` : '—'}
                              {child.classGroup ? ` · ${child.classGroup.name}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)] hidden sm:table-cell">
                        {childAge != null ? `${childAge} yrs` : '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {child.classGroup
                          ? <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
                              {child.classGroup.name}
                            </span>
                          : <span className="text-[var(--muted-foreground)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)] hidden lg:table-cell">
                        {child.household?.last_name} · {child.household?.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)] hidden lg:table-cell">
                        {fmt(child.last_checkin_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-[var(--foreground)]">{child.checkins_count ?? 0}</span>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isOpen && (
                      <tr key={`${child.id}-detail`} className="bg-[var(--primary)]/5">
                        <td colSpan={6} className="px-4 pb-5 pt-2">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Left — Info / Edit */}
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-[var(--foreground)]">Details</h3>
                                <div className="flex gap-2">
                                  {!isEditing && (
                                    <button
                                      onClick={e => { e.stopPropagation(); startEdit(child) }}
                                      className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border)]
                                        text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                                    >
                                      Edit
                                    </button>
                                  )}
                                  {isAdmin && !isEditing && (
                                    <button
                                      onClick={e => { e.stopPropagation(); setConfirmDelete(child.id) }}
                                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200
                                        text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400
                                        dark:hover:bg-red-900/20 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="space-y-3" onClick={e => e.stopPropagation()}>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs text-[var(--muted-foreground)] mb-1">First name</label>
                                      <input className={inputClass} value={editForm.first_name}
                                        onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-[var(--muted-foreground)] mb-1">Last name</label>
                                      <input className={inputClass} value={editForm.last_name}
                                        onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Date of birth</label>
                                    <input type="date" className={inputClass} value={editForm.date_of_birth}
                                      onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Class</label>
                                    <select className={inputClass} value={editForm.class_id}
                                      onChange={e => setEditForm(f => ({ ...f, class_id: e.target.value }))}>
                                      <option value="">No class</option>
                                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Medical notes</label>
                                    <textarea rows={2} className={inputClass} value={editForm.medical_notes}
                                      onChange={e => setEditForm(f => ({ ...f, medical_notes: e.target.value }))} />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">General notes</label>
                                    <textarea rows={3} className={inputClass} value={editForm.notes}
                                      placeholder="Behaviour, personality, special needs, parent preferences…"
                                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                                  </div>
                                  {saveError && <p className="text-xs text-red-500">{saveError}</p>}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSave(child.id)}
                                      disabled={saving}
                                      className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm
                                        font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                      {saving ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); setEditingId(null) }}
                                      className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm
                                        text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2 text-sm">
                                  <InfoRow label="Full name" value={`${child.first_name} ${child.last_name}`} />
                                  <InfoRow label="Age / DOB" value={
                                    childAge != null
                                      ? `${childAge} years old · ${fmt(child.date_of_birth)}`
                                      : '—'
                                  } />
                                  <InfoRow label="Class" value={child.classGroup?.name ?? '—'} />
                                  <InfoRow label="Family" value={
                                    child.household
                                      ? `${child.household.last_name} · ${child.household.phone ?? '—'}`
                                      : '—'
                                  } />
                                  {child.medical_notes && (
                                    <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200
                                      dark:bg-amber-900/20 dark:border-amber-700">
                                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">Medical notes</p>
                                      <p className="text-xs text-amber-800 dark:text-amber-300">{child.medical_notes}</p>
                                    </div>
                                  )}
                                  {child.notes && (
                                    <div className="mt-2 p-2.5 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
                                      <p className="text-xs font-semibold text-[var(--muted-foreground)] mb-0.5">Notes</p>
                                      <p className="text-xs text-[var(--foreground)]">{child.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Right — Check-in history */}
                            <div>
                              <h3 className="font-semibold text-[var(--foreground)] mb-3">
                                Attendance History
                                {checkins.length > 0 && (
                                  <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
                                    {checkins.length} visit{checkins.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </h3>
                              {checkinLoading ? (
                                <p className="text-sm text-[var(--muted-foreground)]">Loading history…</p>
                              ) : checkins.length === 0 ? (
                                <p className="text-sm text-[var(--muted-foreground)]">No visits recorded yet.</p>
                              ) : (
                                <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-[var(--border)] bg-[var(--muted)]/60">
                                        <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)]">Date</th>
                                        <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] hidden sm:table-cell">Service</th>
                                        <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] hidden md:table-cell">Class</th>
                                        <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)]">Teacher</th>
                                        <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] hidden sm:table-cell">In / Out</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {checkins.map((c, i) => (
                                        <tr key={c.id}
                                          className={`border-b border-[var(--border)] last:border-0
                                            ${i % 2 === 0 ? '' : 'bg-[var(--muted)]/20'}`}>
                                          <td className="px-3 py-2 text-[var(--foreground)]">
                                            {fmt(c.checked_in_at)}
                                          </td>
                                          <td className="px-3 py-2 text-[var(--muted-foreground)] hidden sm:table-cell">
                                            {c.service?.name ?? '—'}
                                          </td>
                                          <td className="px-3 py-2 text-[var(--muted-foreground)] hidden md:table-cell">
                                            {c.classGroup?.name ?? '—'}
                                          </td>
                                          <td className="px-3 py-2 text-[var(--foreground)]">
                                            {c.teacher_name ?? '—'}
                                          </td>
                                          <td className="px-3 py-2 text-[var(--muted-foreground)] hidden sm:table-cell">
                                            {fmtTime(c.checked_in_at)}
                                            {c.checked_out_at ? ` → ${fmtTime(c.checked_out_at)}` : ' · active'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">Delete child record?</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">
              This will permanently delete all check-in history for this child. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
                  hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm
                  text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-[var(--muted-foreground)] w-24 flex-shrink-0">{label}</span>
      <span className="text-[var(--foreground)]">{value}</span>
    </div>
  )
}
