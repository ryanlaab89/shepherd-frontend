import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { ME_QUERY, ATTENDANCE_LOGS_QUERY, SERVICES_QUERY, CLASSES_QUERY, CHURCH_SETTINGS_QUERY } from '@/graphql/queries'
import { CHECK_OUT_MUTATION, DELETE_CHECKIN_MUTATION } from '@/graphql/mutations'

function toDateInput(date) { return date.toISOString().split('T')[0] }
function fmtTime(dt) {
  if (!dt) return null
  return new Date(dt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  const now   = new Date()
  let a = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--
  return a
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
  const [detailLog,       setDetailLog]       = useState(null)

  const { data, loading, refetch } = useQuery(ATTENDANCE_LOGS_QUERY, {
    variables: { date, serviceId: serviceId || undefined, classId: classId || undefined },
    fetchPolicy: 'cache-and-network',
  })

  const { data: svcData } = useQuery(SERVICES_QUERY)
  const { data: clsData } = useQuery(CLASSES_QUERY)
  const { data: stgData } = useQuery(CHURCH_SETTINGS_QUERY, { fetchPolicy: 'cache-first' })
  const { data: meData  } = useQuery(ME_QUERY)

  const [checkOut,  { loading: checkingOut }] = useMutation(CHECK_OUT_MUTATION,      { onCompleted: () => { setPendingCheckout(null); refetch() } })
  const [deleteLog, { loading: deletingLog }] = useMutation(DELETE_CHECKIN_MUTATION, { onCompleted: () => { setPendingDelete(null);   refetch() } })

  const showCheckout = (stgData?.churchSettings?.show_checkout ?? true) ||
                       (stgData?.churchSettings?.require_checkout ?? false)
  const services = svcData?.services ?? []
  const classes  = clsData?.classes  ?? []
  const logs     = data?.attendanceLogs ?? []

  const total      = logs.length
  const active     = logs.filter(l => !l.checked_out_at).length
  const checkedOut = total - active

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? logs.filter(l =>
          `${l.person.first_name} ${l.person.last_name}`.toLowerCase().includes(q) ||
          (l.guardian_name ?? '').toLowerCase().includes(q) ||
          (l.pickup_code   ?? '').toLowerCase().includes(q)
        )
      : [...logs]

    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name':     cmp = `${a.person.first_name} ${a.person.last_name}`.localeCompare(`${b.person.first_name} ${b.person.last_name}`); break
        case 'class':    cmp = (a.classGroup?.name ?? '').localeCompare(b.classGroup?.name ?? ''); break
        case 'service':  cmp = (a.service?.name ?? '').localeCompare(b.service?.name ?? ''); break
        case 'guardian': cmp = (a.guardian_name ?? '').localeCompare(b.guardian_name ?? ''); break
        case 'checkout':
          if (!a.checked_out_at && !b.checked_out_at) cmp = 0
          else if (!a.checked_out_at) cmp = 1
          else if (!b.checked_out_at) cmp = -1
          else cmp = new Date(a.checked_out_at) - new Date(b.checked_out_at)
          break
        default: cmp = new Date(a.checked_in_at) - new Date(b.checked_in_at)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [logs, search, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'time' || field === 'checkout' ? 'desc' : 'asc') }
  }

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
  const selectedActive = selectedList.filter(id => logs.find(l => l.id === id) && !logs.find(l => l.id === id)?.checked_out_at)

  async function handleBatchCheckout() {
    setBatchLoading(true)
    await Promise.allSettled(selectedActive.map(id => checkOut({ variables: { checkinId: id } })))
    await refetch(); setSelected(new Set()); setBatchLoading(false)
  }
  async function handleBatchDelete() {
    setBatchLoading(true)
    await Promise.allSettled(selectedList.map(id => deleteLog({ variables: { checkinId: id } })))
    await refetch(); setSelected(new Set()); setBatchLoading(false)
  }

  const isToday    = date === today
  const churchName = meData?.me?.church?.name ?? 'Kids Ministry'
  const dateLabel  = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  function exportAttendanceCSV() {
    if (!visible.length) return
    const headers = showCheckout
      ? ['Child', 'Age', 'Class', 'Guardian', 'Phone', 'Service', 'Code', 'In', 'Out']
      : ['Child', 'Age', 'Class', 'Guardian', 'Phone', 'Service', 'In']
    const rows = visible.map(l => {
      const age = calcAge(l.person.date_of_birth)
      const base = [
        `${l.person.first_name} ${l.person.last_name}`,
        age != null ? `${age} yrs` : '',
        l.classGroup?.name ?? '',
        l.guardian_name ?? '',
        l.guardian_phone ?? '',
        l.service?.name ?? '',
      ]
      if (showCheckout) base.push(l.pickup_code ?? '', fmtTime(l.checked_in_at) ?? '', fmtTime(l.checked_out_at) ?? '')
      else              base.push(fmtTime(l.checked_in_at) ?? '')
      return base
    })
    const csv  = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `attendance-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function printAttendance() {
    if (!visible.length) return
    const timeStr    = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const outHeader  = showCheckout ? '<th>Out</th>' : ''

    function childRow(l) {
      const age = calcAge(l.person.date_of_birth)
      const outCell = showCheckout
        ? `<td>${l.checked_out_at ? fmtTime(l.checked_out_at) : '<span class="here">Here</span>'}</td>`
        : ''
      return `<tr>
        <td><strong>${l.person.first_name} ${l.person.last_name}</strong>${l.person.medical_notes ? ' <span class="med">⚠</span>' : ''}</td>
        <td>${age != null ? `${age} yrs` : '—'}</td>
        <td>${l.classGroup?.name ?? '—'}</td>
        <td>${l.guardian_name ?? '—'}</td>
        <td>${l.guardian_phone ?? '—'}</td>
        <td>${l.service?.name ?? '—'}</td>
        <td>${fmtTime(l.checked_in_at)}</td>
        ${outCell}
      </tr>`
    }

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Attendance — ${dateLabel}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:32px;color:#0f172a;font-size:13px}
      .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1A3A8C}
      .header-left .org{font-size:11px;font-weight:700;color:#1A3A8C;text-transform:uppercase;letter-spacing:.1em}
      .header-left .title{font-size:22px;font-weight:800;color:#0f172a;margin-top:2px}
      .header-left .date{font-size:13px;color:#64748b;margin-top:3px}
      .header-right{text-align:right;font-size:11px;color:#94a3b8;line-height:1.8}
      .header-right strong{color:#64748b}
      .stat-row{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:24px}
      .stat{flex:1;min-width:100px;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 16px}
      .stat .num{font-size:26px;font-weight:800;color:#1A3A8C}
      .stat .lbl{font-size:11px;color:#64748b;margin-top:1px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{text-align:left;padding:7px 10px;font-size:10px;font-weight:600;text-transform:uppercase;
        letter-spacing:.05em;color:#64748b;background:#f8fafc;border-bottom:1.5px solid #e2e8f0}
      td{padding:6px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
      tr:last-child td{border-bottom:none}
      .here{display:inline-block;padding:1px 6px;border-radius:10px;background:#dcfce7;color:#16a34a;font-size:10px;font-weight:600}
      .med{color:#d97706;font-size:11px}
      .pbar{display:flex;gap:8px;margin-bottom:20px}
      .pbtn{padding:8px 18px;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;font-weight:600}
      .pbtn-p{background:#1A3A8C;color:#fff;border:none}
      .pbtn-c{background:#fff;border:1.5px solid #e2e8f0;color:#334155}
      @media print{body{padding:16px}.pbar{display:none!important}}
    </style></head><body>
      <div class="pbar">
        <button class="pbtn pbtn-p" onclick="window.print();window.onafterprint=function(){window.close()}">Print</button>
        <button class="pbtn pbtn-c" onclick="window.close()">✕ Close</button>
      </div>
      <div class="header">
        <div class="header-left">
          <div class="org">${churchName}</div>
          <div class="title">Attendance</div>
          <div class="date">${dateLabel}</div>
        </div>
        <div class="header-right">
          <div>Printed: <strong>${timeStr}</strong></div>
          <div>Total: <strong>${visible.length}</strong></div>
          ${showCheckout ? `<div>Still Here: <strong>${active}</strong></div>` : ''}
        </div>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="num">${visible.length}</div><div class="lbl">Total</div></div>
        ${showCheckout ? `
        <div class="stat"><div class="num">${active}</div><div class="lbl">Still Here</div></div>
        <div class="stat"><div class="num">${checkedOut}</div><div class="lbl">Checked Out</div></div>` : ''}
      </div>
      <table>
        <thead><tr><th>Child</th><th>Age</th><th>Class</th><th>Guardian</th><th>Phone</th><th>Service</th><th>In</th>${outHeader}</tr></thead>
        <tbody>${visible.map(childRow).join('')}</tbody>
      </table>
    </body></html>`)
    win.document.close()
  }

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
        <div className="flex items-center gap-2 flex-wrap">
          {!isToday && (
            <button onClick={() => setDate(today)}
              className="px-3 py-2 rounded-lg border border-[var(--border)] text-sm
                text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
              Today
            </button>
          )}
          <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
            className={selectClass + ' cursor-pointer pr-8'} />
          <Tip text={visible.length === 0 ? 'No records to print' : null}>
            <button onClick={printAttendance} disabled={visible.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)]
                text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]
                hover:border-[var(--primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          </Tip>
          <Tip text={visible.length === 0 ? 'No records to export' : null}>
            <button onClick={exportAttendanceCSV} disabled={visible.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)]
                text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]
                hover:border-[var(--primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
          </Tip>
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
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-4">
        <select value={serviceId} onChange={e => setServiceId(e.target.value)} className={selectClass + ' w-full sm:w-auto'}>
          <option value="">All services</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={classId} onChange={e => setClassId(e.target.value)} className={selectClass + ' w-full sm:w-auto'}>
          <option value="">All classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="col-span-2 relative flex-1 min-w-0">
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
            className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg border border-[var(--border)] text-xs
              text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors">
            Clear filters
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
          border-[var(--border)] rounded-xl">
          <svg className="w-10 h-10 mb-3 text-[var(--muted-foreground)] opacity-40"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm font-medium text-[var(--foreground)]">
            {search || serviceId || classId ? 'No records match your filters' : 'No check-ins recorded for this date'}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 text-center max-w-xs px-4">
            {search || serviceId || classId
              ? 'Try clearing the search or changing the date.'
              : 'Records will appear here as children are checked in.'}
          </p>
        </div>
      ) : (
        <>
        {/* Mobile cards */}
        <div className="md:hidden rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
          {visible.map(log => (
            <MobileAttendanceCard
              key={log.id}
              log={log}
              showCheckout={showCheckout}
              isSelecting={selected.has(log.id)}
              isDeleting={pendingDelete === log.id}
              isCheckingOut={pendingCheckout === log.id}
              deletingLog={deletingLog}
              checkingOut={checkingOut}
              onToggle={toggleRow}
              onExpand={() => setDetailLog(log)}
              onCheckout={() => setPendingCheckout(log.id)}
              onCheckoutConfirm={() => checkOut({ variables: { checkinId: log.id } })}
              onDelete={() => setPendingDelete(log.id)}
              onDeleteConfirm={() => deleteLog({ variables: { checkinId: log.id } })}
              onCancel={() => { setPendingDelete(null); setPendingCheckout(null) }}
            />
          ))}
          <div className="px-4 py-2 bg-[var(--muted)]/30 text-xs text-[var(--muted-foreground)]">
            {visible.length} record{visible.length !== 1 ? 's' : ''}
            {search || serviceId || classId ? ' (filtered)' : ''}
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block rounded-xl border border-[var(--border)] overflow-hidden">
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
                  <th className="w-12 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visible.map(log => {
                  const logAge        = calcAge(log.person.date_of_birth)
                  const isActive      = !log.checked_out_at
                  const isSelecting   = selected.has(log.id)
                  const isDeleting    = pendingDelete   === log.id
                  const isCheckingOut = pendingCheckout === log.id

                  return (
                    <tr key={log.id}
                      onClick={e => { if (e.target.closest('button,input')) return; setDetailLog(log) }}
                      className={`transition-colors cursor-pointer ${
                        isDeleting    ? 'bg-red-50 dark:bg-red-900/10' :
                        isCheckingOut ? 'bg-[var(--primary)]/5' :
                        isSelecting   ? 'bg-[var(--primary)]/5' :
                        'bg-[var(--card)] hover:bg-[var(--muted)]/30'
                      }`}>
                      <td className="px-3 py-4 text-center">
                        <input type="checkbox" checked={isSelecting} onChange={() => toggleRow(log.id)}
                          className="rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer" />
                      </td>
                      <td className="px-4 py-4">
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
                      <td className="px-4 py-4 text-[var(--muted-foreground)] text-sm">
                        {logAge !== null ? `${logAge} yrs` : '—'}
                      </td>
                      <td className="px-4 py-4">
                        {log.classGroup
                          ? <span className="text-xs font-medium px-2 py-0.5 rounded-full
                              bg-[var(--primary)]/10 text-[var(--primary)]">{log.classGroup.name}</span>
                          : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                      </td>
                      <td className="px-4 py-4 text-[var(--muted-foreground)] text-sm">
                        {log.service?.name ?? '—'}
                      </td>
                      <td className="px-4 py-4">
                        {log.guardian_name || log.guardian_phone ? (
                          <div>
                            {log.guardian_name  && <p className="text-sm text-[var(--foreground)]">{log.guardian_name}</p>}
                            {log.guardian_phone && <p className="text-xs text-[var(--muted-foreground)]">{log.guardian_phone}</p>}
                          </div>
                        ) : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                      </td>
                      {showCheckout && (
                        <td className="px-4 py-4">
                          <span className="font-mono font-bold text-[var(--primary)] tracking-widest text-sm">
                            {log.pickup_code}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-4 text-sm text-[var(--foreground)]">
                        {fmtTime(log.checked_in_at)}
                      </td>
                      {showCheckout && (
                        <td className="px-4 py-4 text-sm">
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
                      <td className="px-2 py-4">
                        <RowActions
                          isActive={isActive}
                          showCheckout={showCheckout}
                          isDeleting={isDeleting}
                          isCheckingOut={isCheckingOut}
                          deletingLog={deletingLog}
                          checkingOut={checkingOut}
                          onView={() => setDetailLog(log)}
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
        </>
      )}

      {/* Details modal */}
      {detailLog && (
        <LogDetailsModal
          log={detailLog}
          showCheckout={showCheckout}
          checkingOut={checkingOut}
          onCheckout={() => { checkOut({ variables: { checkinId: detailLog.id } }); setDetailLog(null) }}
          onClose={() => setDetailLog(null)}
        />
      )}
    </div>
  )
}

// ── Log Details Modal ─────────────────────────────────────────────────────────

function LogDetailsModal({ log, showCheckout, checkingOut, onCheckout, onClose }) {
  const isActive = !log.checked_out_at
  const logAge   = calcAge(log.person.date_of_birth)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
      bg-black/50 backdrop-blur-sm" onClick={onClose}>

      <div className="w-full max-w-md bg-[var(--card)] rounded-2xl shadow-2xl
        border border-[var(--border)] overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="w-9 h-9 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
            text-sm font-bold text-[var(--primary)] flex-shrink-0">
            {log.person.first_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--foreground)] truncate">
              {log.person.first_name} {log.person.last_name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {log.service?.name}{log.classGroup ? ` · ${log.classGroup.name}` : ''}
            </p>
          </div>
          {showCheckout && isActive && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5
              rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Here
            </span>
          )}
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Child info */}
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Child</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Age</p>
                <p className="text-[var(--foreground)] font-medium">
                  {logAge != null ? `${logAge} yrs` : '—'}
                  {log.person.date_of_birth && (
                    <span className="text-[var(--muted-foreground)] font-normal ml-1 text-xs">
                      ({fmtDate(log.person.date_of_birth)})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Class</p>
                <p className="text-[var(--foreground)] font-medium">{log.classGroup?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Family</p>
                <p className="text-[var(--foreground)] font-medium">{log.person.household?.last_name ?? '—'}</p>
                {log.person.household?.phone && (
                  <p className="text-xs text-[var(--muted-foreground)]">{log.person.household.phone}</p>
                )}
              </div>
            </div>
            {log.person.medical_notes && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200
                dark:bg-amber-900/20 dark:border-amber-700">
                <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-0.5">Medical Notes</p>
                <p className="text-xs text-amber-800 dark:text-amber-300">{log.person.medical_notes}</p>
              </div>
            )}
          </div>

          {/* Check-in info */}
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Check-In</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Guardian</p>
                <p className="text-[var(--foreground)]">{log.guardian_name || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Phone</p>
                <p className="text-[var(--foreground)]">{log.guardian_phone || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Service</p>
                <p className="text-[var(--foreground)]">{log.service?.name ?? '—'}</p>
              </div>
              {showCheckout && log.pickup_code && (
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Code</p>
                  <p className="font-mono font-bold text-[var(--primary)] tracking-widest">{log.pickup_code}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Checked In</p>
                <p className="text-[var(--foreground)]">{fmtTime(log.checked_in_at)}</p>
              </div>
              {showCheckout && (
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Checked Out</p>
                  <p className="text-[var(--foreground)]">{fmtTime(log.checked_out_at) ?? '—'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {showCheckout && isActive && (
          <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--muted)]/30">
            <button onClick={onCheckout} disabled={checkingOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)]
                text-[var(--primary-foreground)] text-sm font-semibold
                hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
              {checkingOut ? 'Checking out…' : 'Check Out'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MobileAttendanceCard({
  log, showCheckout, isSelecting, isDeleting, isCheckingOut,
  deletingLog, checkingOut, onToggle, onExpand, onCheckout, onCheckoutConfirm,
  onDelete, onDeleteConfirm, onCancel,
}) {
  const isActive = !log.checked_out_at
  const logAge   = calcAge(log.person.date_of_birth)

  return (
    <div
      onClick={e => { if (e.target.closest('button,input')) return; onExpand() }}
      className={`p-4 transition-colors cursor-pointer ${
        isDeleting    ? 'bg-red-50 dark:bg-red-900/10' :
        isCheckingOut ? 'bg-[var(--primary)]/5' :
        isSelecting   ? 'bg-[var(--primary)]/5' :
        'bg-[var(--card)] active:bg-[var(--muted)]/40'
      }`}>
      <div className="flex items-start gap-3">
        <CardCheckbox checked={isSelecting} onChange={() => onToggle(log.id)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                text-xs font-bold text-[var(--primary)] flex-shrink-0">
                {log.person.first_name[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-[var(--foreground)] text-sm truncate">
                    {log.person.first_name} {log.person.last_name}
                  </p>
                  {log.person.medical_notes && (
                    <span title={log.person.medical_notes}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full
                        bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 flex-shrink-0">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                  {showCheckout && (
                    isActive
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5
                          rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                          Here
                        </span>
                      : <span className="text-[10px] text-[var(--muted-foreground)]">
                          Out {fmtTime(log.checked_out_at)}
                        </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5 truncate">
                  {log.service?.name}{log.classGroup ? ` · ${log.classGroup.name}` : ''}
                  {logAge !== null ? ` · ${logAge} yrs` : ''}
                </p>
              </div>
            </div>

            {/* Confirm or kebab */}
            {isCheckingOut ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={onCheckoutConfirm} disabled={checkingOut}
                  className="px-2 py-1 rounded bg-[var(--primary)] text-[var(--primary-foreground)]
                    text-[10px] font-semibold hover:bg-[var(--primary)]/90 disabled:opacity-50">
                  {checkingOut ? '…' : 'Confirm'}
                </button>
                <button onClick={onCancel}
                  className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
                    text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
              </div>
            ) : isDeleting ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={onDeleteConfirm} disabled={deletingLog}
                  className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold
                    hover:bg-red-700 disabled:opacity-50">
                  {deletingLog ? '…' : 'Remove'}
                </button>
                <button onClick={onCancel}
                  className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
                    text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
              </div>
            ) : (
              <MobileAttKebab
                isActive={isActive}
                showCheckout={showCheckout}
                onExpand={onExpand}
                onCheckout={onCheckout}
                onDelete={onDelete}
              />
            )}
          </div>

          {/* Meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--muted-foreground)]">
            {log.guardian_name && <span>{log.guardian_name}</span>}
            {showCheckout && log.pickup_code && (
              <span className="font-mono font-bold text-[var(--primary)] tracking-widest">{log.pickup_code}</span>
            )}
            <span>{fmtTime(log.checked_in_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileAttKebab({ isActive, showCheckout, onExpand, onCheckout, onDelete }) {
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
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  function handleOpen(e) {
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuHeight = showCheckout && isActive ? 130 : 100
      const top = window.innerHeight - rect.bottom >= menuHeight
        ? rect.bottom + 4
        : rect.top - menuHeight - 4
      setDropPos({ top, right: window.innerWidth - rect.right })
    }
    setOpen(v => !v)
  }

  function act(fn) { setOpen(false); fn() }

  return (
    <div className="flex-shrink-0">
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
          className="z-50 w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
          <button onClick={() => act(onExpand)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors text-left">
            <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Details
          </button>
          {showCheckout && isActive && (
            <button onClick={() => act(onCheckout)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--primary)]
                hover:bg-[var(--primary)]/5 transition-colors text-left">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
              Check Out
            </button>
          )}
          <div className="border-t border-[var(--border)] my-0.5" />
          <button onClick={() => act(onDelete)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400
              hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

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
          {loading ? <Spinner sm /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>}
          Check Out {activeCount > 1 ? `(${activeCount})` : ''}
        </button>
      )}
      <button onClick={onDelete} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300
          text-red-600 dark:border-red-700 dark:text-red-400 text-xs font-semibold
          hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
        {loading ? <Spinner sm /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
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
  onView, onCheckout, onCheckoutConfirm, onDelete, onDeleteConfirm, onCancel }) {
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

  if (isCheckingOut) return (
    <div className="flex items-center gap-1">
      <button onClick={onCheckoutConfirm} disabled={checkingOut}
        className="px-2 py-1 rounded bg-[var(--primary)] text-[var(--primary-foreground)]
          text-[10px] font-semibold hover:bg-[var(--primary)]/90 disabled:opacity-50 whitespace-nowrap">
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
        className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold
          hover:bg-red-700 disabled:opacity-50 whitespace-nowrap">
        {deletingLog ? '…' : 'Remove'}
      </button>
      <button onClick={onCancel}
        className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
          text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
    </div>
  )

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuHeight = showCheckout && isActive ? 160 : 130
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
          className="z-50 w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
          <button onClick={() => act(onView)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors text-left">
            <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Details
          </button>
          {showCheckout && isActive && (
            <button onClick={() => act(onCheckout)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--primary)]
                hover:bg-[var(--primary)]/5 transition-colors text-left">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
              Check Out
            </button>
          )}
          <div className="border-t border-[var(--border)] my-0.5" />
          <button onClick={() => act(onDelete)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400
              hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Record
          </button>
        </div>
      )}
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

function CardCheckbox({ checked, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={e => { e.stopPropagation(); onChange() }}
      className={`mt-1 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
        checked
          ? 'bg-[var(--primary)] border-[var(--primary)]'
          : 'bg-transparent border-[var(--border)]'
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
        </svg>
      )}
    </button>
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

function Tip({ text, children }) {
  if (!text) return children
  return (
    <span className="relative group/tip inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
        whitespace-nowrap rounded-lg bg-[var(--foreground)] text-[var(--background)]
        text-xs px-2.5 py-1.5 opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 shadow-sm">
        {text}
      </span>
    </span>
  )
}
