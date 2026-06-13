import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useLazyQuery } from '@apollo/client'
import { CHILDREN_QUERY, CHILD_CHECKINS_QUERY, CLASSES_QUERY } from '@/graphql/queries'
import { UPDATE_PERSON_MUTATION, DELETE_CHILD_MUTATION } from '@/graphql/mutations'
import { useAuth } from '@/features/auth/AuthContext'
import { useToast } from '@/contexts/ToastContext'

function age(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
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
  const toast = useToast()
  const isAdmin = user?.role === 'ADMIN'

  const { data, loading, refetch } = useQuery(CHILDREN_QUERY, { fetchPolicy: 'cache-and-network' })
  const { data: classData } = useQuery(CLASSES_QUERY)

  const [search,        setSearch]        = useState('')
  const [filterClass,   setFilterClass]   = useState('')
  const [sortField,     setSortField]     = useState('name')
  const [sortDir,       setSortDir]       = useState('asc')
  const [detailChild,   setDetailChild]   = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const [loadCheckins, { data: checkinData, loading: checkinLoading }] = useLazyQuery(CHILD_CHECKINS_QUERY)

  const [updatePerson, { loading: saving }] = useMutation(UPDATE_PERSON_MUTATION)
  const [deleteChild,  { loading: deleting }] = useMutation(DELETE_CHILD_MUTATION)

  const children = data?.children ?? []
  const classes  = classData?.classes ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const list = children.filter(c => {
      const name     = `${c.first_name} ${c.last_name}`.toLowerCase()
      const guardian = c.household?.last_name?.toLowerCase() ?? ''
      return (!q || name.includes(q) || guardian.includes(q)) &&
             (!filterClass || c.classGroup?.id === filterClass)
    })
    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      } else if (sortField === 'age') {
        const aT = a.date_of_birth ? new Date(a.date_of_birth).getTime() : 0
        const bT = b.date_of_birth ? new Date(b.date_of_birth).getTime() : 0
        cmp = bT - aT
      } else if (sortField === 'class') {
        cmp = (a.classGroup?.name ?? '').localeCompare(b.classGroup?.name ?? '')
      } else if (sortField === 'lastVisit') {
        cmp = (a.last_checkin_at ? new Date(a.last_checkin_at).getTime() : 0)
            - (b.last_checkin_at ? new Date(b.last_checkin_at).getTime() : 0)
      } else if (sortField === 'visits') {
        cmp = (a.checkins_count ?? 0) - (b.checkins_count ?? 0)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [children, search, filterClass, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function openDetail(child) {
    setDetailChild(child)
    loadCheckins({ variables: { personId: child.id } })
  }

  async function handleSave(personId, form) {
    try {
      await updatePerson({
        variables: {
          personId,
          input: {
            first_name:    form.first_name,
            last_name:     form.last_name,
            date_of_birth: form.date_of_birth || null,
            medical_notes: form.medical_notes || null,
            notes:         form.notes || null,
            class_id:      form.class_id || null,
          },
        },
      })
      toast?.success('Changes saved')
      refetch()
      return null
    } catch (e) {
      return e.message
    }
  }

  async function handleDelete(personId) {
    try {
      await deleteChild({ variables: { personId } })
      toast?.success('Child record deleted')
      setConfirmDelete(null)
      setDetailChild(null)
      refetch()
    } catch (e) {
      toast?.error(e.message)
      setConfirmDelete(null)
    }
  }

  function exportCSV() {
    const headers = ['First Name', 'Last Name', 'Age', 'Class', 'Family', 'Phone', 'Medical Notes', 'Last Visit', 'Total Visits']
    const rows = filtered.map(c => {
      const a = age(c.date_of_birth)
      return [
        c.first_name, c.last_name ?? '',
        a != null ? String(a) : '',
        c.classGroup?.name ?? '',
        c.household?.last_name ?? '',
        c.household?.phone ?? '',
        c.medical_notes ?? '',
        c.last_checkin_at ? fmt(c.last_checkin_at) : '',
        String(c.checkins_count ?? 0),
      ]
    })
    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `children-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const checkins = checkinData?.childCheckins ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Children</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {children.length} registered
          </p>
        </div>
        {filtered.length > 0 && (
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)]
              text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]
              hover:border-[var(--primary)]/50 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input type="text" placeholder="Search by name or family…"
          value={search} onChange={e => setSearch(e.target.value)}
          className={inputClass + ' sm:max-w-xs'} />
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
          className={inputClass + ' sm:max-w-[180px]'}>
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(search || filterClass) && (
          <button onClick={() => { setSearch(''); setFilterClass('') }}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline">
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
                <ChildSortHeader label="Name"       field="name"      sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <ChildSortHeader label="Age"        field="age"       sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="hidden sm:table-cell" />
                <ChildSortHeader label="Class"      field="class"     sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)] hidden lg:table-cell">Family</th>
                <ChildSortHeader label="Last Visit" field="lastVisit" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                <ChildSortHeader label="Visits"     field="visits"    sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right" />
                <th className="w-12 px-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(child => {
                const childAge = age(child.date_of_birth)
                return (
                  <tr key={child.id}
                    onClick={e => { if (e.target.closest('button')) return; openDetail(child) }}
                    className="border-b border-[var(--border)] cursor-pointer transition-colors
                      bg-[var(--card)] hover:bg-[var(--muted)]/40">
                    <td className="px-4 py-4">
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
                    <td className="px-4 py-4 text-[var(--muted-foreground)] hidden sm:table-cell">
                      {childAge != null ? `${childAge} yrs` : '—'}
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {child.classGroup
                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
                            {child.classGroup.name}
                          </span>
                        : <span className="text-[var(--muted-foreground)]">—</span>}
                    </td>
                    <td className="px-4 py-4 text-[var(--muted-foreground)] hidden lg:table-cell">
                      {child.household?.last_name} · {child.household?.phone ?? '—'}
                    </td>
                    <td className="px-4 py-4 text-[var(--muted-foreground)] hidden lg:table-cell">
                      {fmt(child.last_checkin_at)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-semibold text-[var(--foreground)]">{child.checkins_count ?? 0}</span>
                    </td>
                    <td className="px-2 py-4">
                      <ChildKebab
                        isAdmin={isAdmin}
                        onView={() => openDetail(child)}
                        onEdit={() => openDetail(child)}
                        onDelete={() => setConfirmDelete(child.id)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--muted)]/30
            text-xs text-[var(--muted-foreground)]">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            {(search || filterClass) ? ' (filtered)' : ''}
          </div>
        </div>
      )}

      {/* Details modal */}
      {detailChild && (
        <ChildDetailsModal
          child={detailChild}
          classes={classes}
          checkins={checkins}
          checkinLoading={checkinLoading}
          saving={saving}
          isAdmin={isAdmin}
          onSave={handleSave}
          onRequestDelete={id => { setConfirmDelete(id) }}
          onClose={() => setDetailChild(null)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">Delete child record?</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">
              This will permanently delete all check-in history for this child. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
                  hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm
                  text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Child Details Modal ───────────────────────────────────────────────────────

function ChildDetailsModal({ child, classes, checkins, checkinLoading, saving, isAdmin,
  onSave, onRequestDelete, onClose }) {
  const [isEditing,  setIsEditing]  = useState(false)
  const [editForm,   setEditForm]   = useState({})
  const [saveError,  setSaveError]  = useState('')

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function startEdit() {
    setEditForm({
      first_name:    child.first_name,
      last_name:     child.last_name,
      date_of_birth: child.date_of_birth ?? '',
      medical_notes: child.medical_notes ?? '',
      notes:         child.notes ?? '',
      class_id:      child.classGroup?.id ?? '',
    })
    setSaveError('')
    setIsEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaveError('')
    const err = await onSave(child.id, editForm)
    if (err) { setSaveError(err) } else { setIsEditing(false) }
  }

  const childAge = (() => {
    if (!child.date_of_birth) return null
    return Math.floor((Date.now() - new Date(child.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
      bg-black/50 backdrop-blur-sm" onClick={onClose}>

      <div className="w-full max-w-2xl bg-[var(--card)] rounded-2xl shadow-2xl
        border border-[var(--border)] flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
            text-sm font-bold text-[var(--primary)] flex-shrink-0">
            {child.first_name[0]}{child.last_name?.[0] ?? ''}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--foreground)]">
              {child.first_name} {child.last_name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {childAge != null ? `${childAge} yrs` : 'No DOB'}
              {child.classGroup ? ` · ${child.classGroup.name}` : ''}
            </p>
          </div>
          {!isEditing && (
            <div className="flex items-center gap-1.5 mr-2">
              <button onClick={startEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)]
                  text-xs text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>
              {isAdmin && (
                <button onClick={() => onRequestDelete(child.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200
                    text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400
                    dark:hover:bg-red-900/20 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          )}
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="px-5 py-4 grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left — info / edit */}
            <div>
              <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                {isEditing ? 'Edit Child' : 'Details'}
              </p>

              {isEditing ? (
                <form onSubmit={handleSave} className="space-y-3">
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
                      placeholder="Behaviour, personality, special needs…"
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                  {saveError && <p className="text-xs text-red-500">{saveError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={saving}
                      className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                        text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setIsEditing(false)}
                      className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm
                        text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2 text-sm">
                  <DetailRow label="Full name"  value={`${child.first_name} ${child.last_name}`} />
                  <DetailRow label="Age / DOB"  value={childAge != null ? `${childAge} yrs · ${fmt(child.date_of_birth)}` : '—'} />
                  <DetailRow label="Class"      value={child.classGroup?.name ?? '—'} />
                  <DetailRow label="Family"     value={child.household ? `${child.household.last_name} · ${child.household.phone ?? '—'}` : '—'} />
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

            {/* Right — attendance history */}
            <div>
              <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                Attendance History
                {checkins.length > 0 && (
                  <span className="ml-1.5 normal-case font-normal">
                    ({checkins.length} visit{checkins.length !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
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
                        <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)]">In / Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkins.map((c, i) => (
                        <tr key={c.id} className={`border-b border-[var(--border)] last:border-0
                          ${i % 2 === 0 ? '' : 'bg-[var(--muted)]/20'}`}>
                          <td className="px-3 py-2 text-[var(--foreground)]">{fmt(c.checked_in_at)}</td>
                          <td className="px-3 py-2 text-[var(--muted-foreground)] hidden sm:table-cell">{c.service?.name ?? '—'}</td>
                          <td className="px-3 py-2 text-[var(--muted-foreground)] hidden md:table-cell">{c.classGroup?.name ?? '—'}</td>
                          <td className="px-3 py-2 text-[var(--muted-foreground)]">
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
        </div>
      </div>
    </div>
  )
}

// ── Child kebab menu ──────────────────────────────────────────────────────────

function ChildKebab({ isAdmin, onView, onEdit, onDelete }) {
  const [open,    setOpen]    = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const btnRef  = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function close(e) {
      if (btnRef.current?.contains(e.target)) return
      if (dropRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function handleOpen(e) {
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuHeight = isAdmin ? 130 : 100
      const top = window.innerHeight - rect.bottom >= menuHeight
        ? rect.bottom + 4
        : rect.top - menuHeight - 4
      setDropPos({ top, right: window.innerWidth - rect.right })
    }
    setOpen(v => !v)
  }

  function act(fn) { setOpen(false); fn() }

  return (
    <div className="flex justify-end">
      <button ref={btnRef} onClick={handleOpen}
        className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)]
          hover:bg-[var(--muted)] transition-colors">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right }}
          className="z-50 w-40 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
          <button onClick={() => act(onView)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors text-left">
            <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Details
          </button>
          <button onClick={() => act(onEdit)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors text-left">
            <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
          {isAdmin && (
            <>
              <div className="border-t border-[var(--border)] my-0.5" />
              <button onClick={() => act(onDelete)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400
                  hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-[var(--muted-foreground)] w-24 flex-shrink-0">{label}</span>
      <span className="text-[var(--foreground)]">{value}</span>
    </div>
  )
}

function ChildSortHeader({ label, field, sortField, sortDir, onSort, className = '', align = 'left' }) {
  const active = sortField === field
  return (
    <th className={`px-4 py-3 font-medium text-[var(--muted-foreground)] text-${align} ${className}`}>
      <button onClick={() => onSort(field)}
        className={`flex items-center gap-1 hover:text-[var(--foreground)] transition-colors
          ${align === 'right' ? 'ml-auto' : ''}
          ${active ? 'text-[var(--foreground)]' : ''}`}>
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}>
          {active && sortDir === 'asc' ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </span>
      </button>
    </th>
  )
}
