import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { ATTENDANCE_LOGS_QUERY, SERVICES_QUERY, CLASSES_QUERY, CHURCH_SETTINGS_QUERY } from '@/graphql/queries'
import { CHECK_OUT_MUTATION, DELETE_CHECKIN_MUTATION } from '@/graphql/mutations'

function toDateInput(date) { return date.toISOString().split('T')[0] }
function fmtTime(dt) {
  if (!dt) return null
  return new Date(dt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  const now   = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

const selectClass = `px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50
  focus:border-[var(--ring)] transition-colors cursor-pointer`

export default function AttendancePage() {
  const today = toDateInput(new Date())

  const [date,            setDate]            = useState(today)
  const [serviceId,       setServiceId]       = useState('')
  const [classId,         setClassId]         = useState('')
  const [search,          setSearch]          = useState('')
  const [sortField,       setSortField]       = useState('time')
  const [sortDir,         setSortDir]         = useState('desc')
  const [pendingDelete,   setPendingDelete]   = useState(null)
  const [pendingCheckout, setPendingCheckout] = useState(null)
  const [selected,        setSelected]        = useState(new Set())
  const [batchLoading,    setBatchLoading]    = useState(false)

  const { data, loading, refetch } = useQuery(ATTENDANCE_LOGS_QUERY, {
    variables: { date, serviceId: serviceId || undefined, classId: classId || undefined },
    fetchPolicy: 'cache-and-network',
  })

  const { data: svcData } = useQuery(SERVICES_QUERY)
  const { data: clsData } = useQuery(CLASSES_QUERY)
  const { data: stgData } = useQuery(CHURCH_SETTINGS_QUERY, { fetchPolicy: 'cache-first' })

  const [checkOut,  { loading: checkingOut }] = useMutation(CHECK_OUT_MUTATION,      { onCompleted: () => { setPendingCheckout(null); refetch() } })
  const [deleteLog, { loading: deletingLog }] = useMutation(DELETE_CHECKIN_MUTATION, { onCompleted: () => { setPendingDelete(null);   refetch() } })

  const showCheckout = (stgData?.churchSettings?.show_checkout ?? true) ||
                       (stgData?.churchSettings?.require_checkout ?? false)
  const services  = svcData?.services ?? []
  const classes   = clsData?.classes  ?? []
  const logs      = data?.attendanceLogs ?? []

  const total      = logs.length
  const active     = logs.filter(l => !l.checked_out_at).length
  const checkedOut = total - active

  // Filter + sort
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? logs.filter(l =>
          `${l.person.first_name} ${l.person.last_name}`.toLowerCase().includes(q) ||
          (l.guardian_name  ?? '').toLowerCase().includes(q) ||
          (l.pickup_code    ?? '').toLowerCase().includes(q)
        )
      : [...logs]

    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = `${a.person.first_name} ${a.person.last_name}`
            .localeCompare(`${b.person.first_name} ${b.person.last_name}`)
          break
        case 'class':
          cmp = (a.classGroup?.name ?? '').localeCompare(b.classGroup?.name ?? '')
          break
        case 'service':
          cmp = (a.service?.name ?? '').localeCompare(b.service?.name ?? '')
          break
        case 'guardian':
          cmp = (a.guardian_name ?? '').localeCompare(b.guardian_name ?? '')
          break
        case 'checkout':
          if (!a.checked_out_at && !b.checked_out_at) cmp = 0
          else if (!a.checked_out_at) cmp = 1
          else if (!b.checked_out_at) cmp = -1
          else cmp = new Date(a.checked_out_at) - new Date(b.checked_out_at)
          break
        default:
          cmp = new Date(a.checked_in_at) - new Date(b.checked_in_at)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [logs, search, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'time' || field === 'checkout' ? 'desc' : 'asc') }
  }

  // Multi-select
  const visibleIds   = visible.map(l => l.id)
  const allSelected  = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
  const someSelected = visibleIds.some(id => selected.has(id)) && !allSelected

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) visibleIds.forEach(id => next.delete(id))
      else             visibleIds.forEach(id => next.add(id))
      return next
    })
  }
  function toggleRow(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const selectedList   = [...selected]
  const selectedActive = selectedList.filter(id => {
    const row = logs.find(l => l.id === id)
    return row && !row.checked_out_at
  })

  async function handleBatchCheckout() {
    setBatchLoading(true)
    await Promise.allSettled(selectedActive.map(id => checkOut({ variables: { checkinId: id } })))
    await refetch()
    setSelected(new Set())
    setBatchLoading(false)
  }

  async function handleBatchDelete() {
    setBatchLoading(true)
    await Promise.allSettled(selectedList.map(id => deleteLog({ variables: { checkinId: id } })))
    await refetch()
    setSelected(new Set())
    setBatchLoading(false)
  }

  const isToday = date === today

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Attendance</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isToday && (
            <button onClick={() => setDate(today)}
              className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm
                text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
              Today
            </button>
          )}
          <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
            className={selectClass + ' cursor-pointer'} />
        </div>
      </div>

      {/* Stat cards */}
      <div className={`grid gap-3 mb-6 ${showCheckout ? 'grid-cols-3' : 'grid-cols-1 max-w-xs'}`}>
        <StatCard label="Total" value={loading ? '—' : total} color="primary"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        {showCheckout && <>
          <StatCard label="Still Here" value={loading ? '—' : active} color="accent"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
          <StatCard label="Checked Out" value={loading ? '—' : checkedOut} color="muted"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} />
        </>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={selectClass}>
          <option value="">All services</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={classId} onChange={e => setClassId(e.target.value)} className={selectClass}>
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search child, guardian, or code…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
              text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]
              focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {(serviceId || classId) && (
          <button onClick={() => { setServiceId(''); setClassId('') }}
            className="px-3 py-2 rounded-lg border border-[var(--border)] text-xs
              text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Batch bar */}
      {selected.size > 0 && (
        <BatchBar
          count={selected.size}
          activeCount={selectedActive.length}
          showCheckout={showCheckout}
          loading={batchLoading}
          onCheckout={handleBatchCheckout}
          onDelete={handleBatchDelete}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20 text-[var(--muted-foreground)]"><Spinner /></div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed
          border-[var(--border)] rounded-xl text-[var(--muted-foreground)]">
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">
            {search || serviceId || classId ? 'No records match the current filters' : 'No check-ins recorded for this date'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)]">
                  <th className="px-3 py-3 w-10">
                    <IndeterminateCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                  </th>
                  <SortTh label="Child"    field="name"     {...{ sortField, sortDir, toggleSort }} />
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Age</th>
                  <SortTh label="Class"    field="class"    {...{ sortField, sortDir, toggleSort }} />
                  <SortTh label="Service"  field="service"  {...{ sortField, sortDir, toggleSort }} />
                  <SortTh label="Guardian" field="guardian" {...{ sortField, sortDir, toggleSort }} />
                  {showCheckout && (
                    <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Code</th>
                  )}
                  <SortTh label="In"  field="time"     {...{ sortField, sortDir, toggleSort }} />
                  {showCheckout && (
                    <SortTh label="Out" field="checkout" {...{ sortField, sortDir, toggleSort }} />
                  )}
                  <th className="w-20 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map(log => {
                  const age           = calcAge(log.person.date_of_birth)
                  const isActive      = !log.checked_out_at
                  const isSelecting   = selected.has(log.id)
                  const isDeleting    = pendingDelete   === log.id
                  const isCheckingOut = pendingCheckout === log.id

                  return (
                    <tr key={log.id} className={`transition-colors ${
                      isDeleting    ? 'bg-red-50 dark:bg-red-900/10' :
                      isCheckingOut ? 'bg-[var(--primary)]/5' :
                      isSelecting   ? 'bg-[var(--primary)]/5' :
                      'bg-[var(--card)] hover:bg-[var(--muted)]/30'
                    }`}>
                      <td className="px-3 py-3 text-center">
                        <input type="checkbox" checked={isSelecting} onChange={() => toggleRow(log.id)}
                          className="rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[var(--primary)]/15 flex items-center
                            justify-center text-xs font-bold text-[var(--primary)] flex-shrink-0">
                            {log.person.first_name[0]}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--foreground)]">
                              {log.person.first_name} {log.person.last_name}
                            </p>
                            {log.person.medical_notes && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Medical
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)] text-sm">
                        {age !== null ? `${age} yrs` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {log.classGroup
                          ? <span className="text-xs font-medium px-2 py-0.5 rounded-full
                              bg-[var(--primary)]/10 text-[var(--primary)]">{log.classGroup.name}</span>
                          : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)] text-sm">
                        {log.service?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {log.guardian_name || log.guardian_phone ? (
                          <div>
                            {log.guardian_name && <p className="text-sm text-[var(--foreground)]">{log.guardian_name}</p>}
                            {log.guardian_phone && <p className="text-xs text-[var(--muted-foreground)]">{log.guardian_phone}</p>}
                          </div>
                        ) : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                      </td>
                      {showCheckout && (
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-[var(--primary)] tracking-widest text-sm">
                            {log.pickup_code}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                        {fmtTime(log.checked_in_at)}
                      </td>
                      {showCheckout && (
                        <td className="px-4 py-3 text-sm">
                          {log.checked_out_at
                            ? <span className="text-[var(--muted-foreground)]">{fmtTime(log.checked_out_at)}</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5
                                rounded-full bg-emerald-100 text-emerald-700
                                dark:bg-emerald-900/30 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Here
                              </span>}
                        </td>
                      )}
                      <td className="px-2 py-3">
                        <RowActions
                          isActive={isActive}
                          showCheckout={showCheckout}
                          isDeleting={isDeleting}
                          isCheckingOut={isCheckingOut}
                          deletingLog={deletingLog}
                          checkingOut={checkingOut}
                          onCheckout={() => setPendingCheckout(log.id)}
                          onCheckoutConfirm={() => checkOut({ variables: { checkinId: log.id } })}
                          onDelete={() => setPendingDelete(log.id)}
                          onDeleteConfirm={() => deleteLog({ variables: { checkinId: log.id } })}
                          onCancel={() => { setPendingDelete(null); setPendingCheckout(null) }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--muted)]/30
            text-xs text-[var(--muted-foreground)] flex items-center justify-between">
            <span>{visible.length} record{visible.length !== 1 ? 's' : ''}{search || serviceId || classId ? ' (filtered)' : ''}</span>
            {!isToday && <span className="italic">Historical record</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BatchBar({ count, activeCount, showCheckout, loading, onCheckout, onDelete, onClear }) {
  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap px-3 py-2.5 rounded-lg
      bg-[var(--primary)]/5 border border-[var(--primary)]/20">
      <span className="text-sm font-medium text-[var(--primary)] mr-1">{count} selected</span>
      {showCheckout && activeCount > 0 && (
        <button onClick={onCheckout} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-xs font-semibold
            hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">
          {loading
            ? <Spinner sm />
            : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>}
          Check Out {activeCount > 1 ? `(${activeCount})` : ''}
        </button>
      )}
      <button onClick={onDelete} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300
          text-red-600 dark:border-red-700 dark:text-red-400 text-xs font-semibold
          hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
        {loading
          ? <Spinner sm />
          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>}
        Delete ({count})
      </button>
      <button onClick={onClear}
        className="ml-auto text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
        Clear selection
      </button>
    </div>
  )
}

function RowActions({ isActive, showCheckout, isDeleting, isCheckingOut, deletingLog, checkingOut,
  onCheckout, onCheckoutConfirm, onDelete, onDeleteConfirm, onCancel }) {
  if (isCheckingOut) return (
    <div className="flex items-center gap-1">
      <button onClick={onCheckoutConfirm} disabled={checkingOut}
        className="px-2 py-1 rounded bg-[var(--primary)] text-[var(--primary-foreground)]
          text-[10px] font-medium hover:bg-[var(--primary)]/90 disabled:opacity-50 whitespace-nowrap">
        {checkingOut ? '…' : 'Confirm'}
      </button>
      <button onClick={onCancel}
        className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
          text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
    </div>
  )
  if (isDeleting) return (
    <div className="flex items-center gap-1">
      <button onClick={onDeleteConfirm} disabled={deletingLog}
        className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-medium
          hover:bg-red-700 disabled:opacity-50 whitespace-nowrap">
        {deletingLog ? '…' : 'Remove'}
      </button>
      <button onClick={onCancel}
        className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
          text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
    </div>
  )
  return (
    <div className="flex items-center gap-0.5 opacity-0 [tr:hover_&]:opacity-100 transition-opacity">
      {showCheckout && isActive && (
        <button onClick={onCheckout} title="Check out"
          className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--primary)]
            hover:bg-[var(--primary)]/10 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
          </svg>
        </button>
      )}
      <button onClick={onDelete} title="Remove record"
        className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-500
          hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}

function IndeterminateCheckbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer" />
  )
}

function SortTh({ label, field, sortField, sortDir, toggleSort }) {
  const active = sortField === field
  return (
    <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">
      <button onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 hover:text-[var(--foreground)] transition-colors ${active ? 'text-[var(--foreground)]' : ''}`}>
        {label}
        <span className={active ? 'opacity-100' : 'opacity-30'}>
          {active && sortDir === 'asc'
            ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
            : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>}
        </span>
      </button>
    </th>
  )
}

function StatCard({ label, value, icon, color }) {
  const colors = {
    primary: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    accent:  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    muted:   'bg-[var(--muted)] text-[var(--muted-foreground)]',
  }
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
        <div className={`p-1.5 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  )
}

function Spinner({ sm }) {
  return (
    <svg className={`animate-spin ${sm ? 'w-3.5 h-3.5' : 'w-6 h-6'} text-[var(--primary)]`}
      fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
