import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { useToast } from '@/contexts/ToastContext'
import {
  TODAY_CHECKINS_QUERY,
  CHURCH_SETTINGS_QUERY,
  TODAY_CLASS_SESSIONS_QUERY,
  SERVICES_QUERY,
  USERS_QUERY,
} from '@/graphql/queries'
import {
  SET_CLASS_SESSION_MUTATION,
  DELETE_CHECKIN_MUTATION,
  AUTO_CHECKOUT_SERVICE_MUTATION,
  CHECK_OUT_MUTATION,
} from '@/graphql/mutations'
import { detectActiveService } from '@/lib/serviceUtils'
import { isValidPhone } from '@/lib/validators'
import PhoneInput from '@/components/PhoneInput'

function fmtTime(dt) {
  if (!dt) return null
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function DashboardPage() {
  const toast = useToast()
  const [search,          setSearch]          = useState('')
  const [filterServiceId, setFilterServiceId] = useState('')
  const [filterClassId,   setFilterClassId]   = useState('')
  const [sortField,       setSortField]       = useState('time')
  const [sortDir,         setSortDir]         = useState('desc')
  const [autoService,     setAutoService]     = useState(null)
  const [pendingDelete,   setPendingDelete]   = useState(null)
  const [pendingCheckout, setPendingCheckout] = useState(null)
  const [autoCheckoutMsg, setAutoCheckoutMsg] = useState('')
  const [selected,        setSelected]        = useState(new Set())
  const [batchLoading,    setBatchLoading]    = useState(false)
  const [quickCode,       setQuickCode]       = useState('')
  const [quickLoading,    setQuickLoading]    = useState(false)
  const prevServiceRef = useRef(null)
  const navigate = useNavigate()

  const { data: classData  } = useQuery(TODAY_CLASS_SESSIONS_QUERY, { fetchPolicy: 'cache-and-network', pollInterval: 60000 })
  const { data: usersData  } = useQuery(USERS_QUERY)
  const { data: servicesData } = useQuery(SERVICES_QUERY)
  const { data: settingsData } = useQuery(CHURCH_SETTINGS_QUERY)

  const classes    = classData?.todayClassSessions ?? []
  const staffList  = usersData?.users ?? []
  const allServices = servicesData?.services ?? []
  const showCheckout = (settingsData?.churchSettings?.show_checkout ?? true) ||
                       (settingsData?.churchSettings?.require_checkout ?? false)

  const { data: todayData, loading, refetch } = useQuery(TODAY_CHECKINS_QUERY, { fetchPolicy: 'cache-and-network', pollInterval: 30000 })
  const rawList = todayData?.todayCheckins ?? []

  // Stats derived from live data
  const totalToday  = rawList.length
  const currentlyIn = rawList.filter(r => !r.checked_out_at).length
  const checkedOut  = totalToday - currentlyIn
  const byService   = Object.values(
    rawList.reduce((acc, c) => {
      if (!c.checked_out_at) {
        const key = c.service.id
        if (!acc[key]) acc[key] = { service_name: c.service.name, count: 0 }
        acc[key].count++
      }
      return acc
    }, {})
  )

  const refetchAll = { refetchQueries: [{ query: TODAY_CHECKINS_QUERY }], awaitRefetchQueries: true }

  const [deleteCheckin,       { loading: deleting     }] = useMutation(DELETE_CHECKIN_MUTATION,       refetchAll)
  const [checkOutMutation,    { loading: checkingOut  }] = useMutation(CHECK_OUT_MUTATION,            refetchAll)
  const [autoCheckoutService]                            = useMutation(AUTO_CHECKOUT_SERVICE_MUTATION, { refetchQueries: [{ query: TODAY_CHECKINS_QUERY }] })

  // Auto-checkout when service ends (only when checkout is disabled — system manages it)
  useEffect(() => {
    if (showCheckout) return
    if (!allServices.length) return
    function tick() {
      const result = detectActiveService(allServices)
      const currentId = result?.service?.id ?? null
      const prev = prevServiceRef.current
      if (prev !== null && prev !== currentId) {
        autoCheckoutService({ variables: { serviceId: prev } })
          .then(({ data }) => {
            const count = data?.autoCheckoutService ?? 0
            if (count > 0) {
              const name = allServices.find(s => s.id === prev)?.name ?? 'previous service'
              setAutoCheckoutMsg(`Auto-checked out ${count} ${count === 1 ? 'child' : 'children'} from ${name}`)
              setTimeout(() => setAutoCheckoutMsg(''), 6000)
            }
          }).catch(() => {})
      }
      prevServiceRef.current = currentId
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [allServices.length, showCheckout]) // eslint-disable-line

  useEffect(() => {
    const result = detectActiveService(allServices)
    const id = result?.service?.id ?? null
    setAutoService(id)
    if (id && filterServiceId === '') setFilterServiceId(id)
  }, [allServices.length]) // eslint-disable-line

  // Filter + sort
  const serviceOptions = Array.from(new Map(rawList.map(c => [c.service.id, c.service])).values())
    .sort((a, b) => a.name.localeCompare(b.name))
  const classOptions = Array.from(
    new Map(rawList.filter(c => c.classGroup).map(c => [c.classGroup.id, c.classGroup])).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const q = search.trim().toLowerCase()
  let checkins = rawList
  if (filterServiceId) checkins = checkins.filter(c => c.service.id === filterServiceId)
  if (filterClassId)   checkins = checkins.filter(c => c.classGroup?.id === filterClassId)
  if (q) checkins = checkins.filter(c =>
    `${c.person.first_name} ${c.person.last_name}`.toLowerCase().includes(q) ||
    (c.guardian_name ?? '').toLowerCase().includes(q)
  )

  checkins = [...checkins].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'name':
        cmp = `${a.person.first_name} ${a.person.last_name}`
          .localeCompare(`${b.person.first_name} ${b.person.last_name}`)
        break
      case 'class':
        cmp = (a.classGroup?.name ?? '').localeCompare(b.classGroup?.name ?? '')
        break
      case 'guardian':
        cmp = (a.guardian_name ?? '').localeCompare(b.guardian_name ?? '')
        break
      case 'service':
        cmp = (a.service?.name ?? '').localeCompare(b.service?.name ?? '')
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

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'time' || field === 'checkout' ? 'desc' : 'asc') }
  }

  // Multi-select
  const visibleIds  = checkins.map(c => c.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
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

  const selectedList = [...selected]
  const selectedActive = selectedList.filter(id => {
    const row = rawList.find(r => r.id === id)
    return row && !row.checked_out_at
  })

  async function handleBatchCheckout() {
    setBatchLoading(true)
    await Promise.allSettled(selectedActive.map(id => checkOutMutation({ variables: { checkinId: id } })))
    await refetch()
    setSelected(new Set())
    setPendingCheckout(null)
    setBatchLoading(false)
  }

  async function handleBatchDelete() {
    setBatchLoading(true)
    await Promise.allSettled(selectedList.map(id => deleteCheckin({ variables: { checkinId: id } })))
    await refetch()
    setSelected(new Set())
    setPendingDelete(null)
    setBatchLoading(false)
  }

  async function handleQuickCheckout(e) {
    e.preventDefault()
    const code = quickCode.trim().toUpperCase()
    if (!code) return
    const match = rawList.find(c => c.pickup_code === code && !c.checked_out_at)
    if (!match) {
      toast?.error(`No active check-in found for code "${code}"`)
      return
    }
    setQuickLoading(true)
    try {
      await checkOutMutation({ variables: { checkinId: match.id } })
      toast?.success(`${match.person.first_name} ${match.person.last_name} checked out`)
      setQuickCode('')
    } catch (err) {
      toast?.error(err.message || 'Could not check out')
    } finally {
      setQuickLoading(false)
    }
  }

  function exportCSV() {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const headers = showCheckout
      ? ['Child', 'Class', 'Guardian', 'Phone', 'Service', 'Code', 'In', 'Out']
      : ['Child', 'Class', 'Guardian', 'Phone', 'Service', 'In']
    const rows = checkins.map(c => {
      const base = [
        `${c.person.first_name} ${c.person.last_name}`,
        c.classGroup?.name ?? '',
        c.guardian_name ?? '',
        c.guardian_phone ?? '',
        c.service.name,
      ]
      if (showCheckout) {
        base.push(c.pickup_code ?? '', fmtTime(c.checked_in_at) ?? '', c.checked_out_at ? (fmtTime(c.checked_out_at) ?? '') : '')
      } else {
        base.push(fmtTime(c.checked_in_at) ?? '')
      }
      return base
    })
    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `attendance-${date.replace(/[, ]+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isAutoService = filterServiceId === autoService && !!autoService

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => navigate('/checkin')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-sm font-semibold flex-shrink-0 whitespace-nowrap
            hover:bg-[var(--primary)]/90 active:scale-95 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Check In
        </button>
      </div>

      {/* Stat cards */}
      <div className={`grid gap-2 sm:gap-4 mb-8 ${showCheckout ? 'grid-cols-3' : 'grid-cols-1 max-w-xs'}`}>
        <StatCard label="Checked In Today" value={loading ? '—' : totalToday} color="primary"
          icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        {showCheckout && <>
          <StatCard label="Still Here" value={loading ? '—' : currentlyIn} color="accent"
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
          <StatCard label="Checked Out" value={loading ? '—' : checkedOut} color="muted"
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} />
        </>}
      </div>

      {/* Today's Classes */}
      {classes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Today's Classes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {classes.map(cls => <ClassSessionCard key={cls.id} cls={cls} staffList={staffList} />)}
          </div>
        </div>
      )}

      {/* By service */}
      {byService.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Active by Service</h2>
          <div className="flex flex-wrap gap-2">
            {byService.map(row => (
              <div key={row.service_name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
                <span className="text-sm text-[var(--foreground)]">{row.service_name}</span>
                <span className="text-sm font-bold text-[var(--primary)]">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {autoCheckoutMsg && (
        <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl
          bg-emerald-50 border border-emerald-200 text-emerald-800
          dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium">{autoCheckoutMsg}</p>
        </div>
      )}

      {/* Attendance table */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Today's Attendance</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">Auto-refreshes every 30s</span>
            {checkins.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)]
                  text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)]/50
                  transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Quick checkout by pickup code */}
        {showCheckout && (
          <form onSubmit={handleQuickCheckout} className="flex items-center gap-2 mb-3">
            <div className="relative">
              <input
                value={quickCode}
                onChange={e => setQuickCode(e.target.value.toUpperCase())}
                placeholder="Pickup code…"
                maxLength={6}
                className="w-36 pl-3 pr-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
                  text-[var(--foreground)] text-sm uppercase tracking-widest font-mono placeholder:normal-case
                  placeholder:tracking-normal placeholder:text-[var(--muted-foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={quickLoading || !quickCode.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)]
                text-[var(--primary-foreground)] text-xs font-semibold
                hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors"
            >
              {quickLoading ? <Spinner sm /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7" />
                </svg>
              )}
              Quick Check Out
            </button>
          </form>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="relative">
            <select value={filterServiceId} onChange={e => setFilterServiceId(e.target.value)} className={filterSelect}>
              <option value="">All services</option>
              {serviceOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {isAutoService && (
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 py-0.5 rounded-full
                bg-[var(--primary)] text-[var(--primary-foreground)] leading-none pointer-events-none">Auto</span>
            )}
          </div>
          <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} className={filterSelect}>
            <option value="">All classes</option>
            {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative flex-1 min-w-[160px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or guardian…"
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
          {(filterServiceId || filterClassId) && (
            <button onClick={() => { setFilterServiceId(''); setFilterClassId('') }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[var(--border)]
                text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>

        {/* Batch action bar */}
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

        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--muted-foreground)]"><Spinner /></div>
        ) : checkins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--muted-foreground)]
            border border-dashed border-[var(--border)] rounded-xl">
            <p className="text-sm">
              {q || filterServiceId || filterClassId ? 'No children match the filters' : 'No children checked in yet'}
            </p>
          </div>
        ) : (
          <>
          {/* Mobile card layout */}
          <div className="md:hidden rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
            {checkins.map(c => (
              <MobileCheckinCard
                key={c.id}
                c={c}
                showCheckout={showCheckout}
                isSelecting={selected.has(c.id)}
                isDeleting={pendingDelete === c.id}
                isCheckingOut={pendingCheckout === c.id}
                deleting={deleting}
                checkingOut={checkingOut}
                onToggle={toggleRow}
                onCheckout={() => setPendingCheckout(c.id)}
                onCheckoutConfirm={() => { checkOutMutation({ variables: { checkinId: c.id } }); setPendingCheckout(null) }}
                onDelete={() => setPendingDelete(c.id)}
                onDeleteConfirm={() => deleteCheckin({ variables: { checkinId: c.id } })}
                onCancel={() => { setPendingDelete(null); setPendingCheckout(null) }}
              />
            ))}
            <div className="px-4 py-2 bg-[var(--muted)]/30 text-xs text-[var(--muted-foreground)]">
              {checkins.length} record{checkins.length !== 1 ? 's' : ''}
              {(filterServiceId || filterClassId || q) ? ' (filtered)' : ''}
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                  <th className="px-3 py-3 w-10">
                    <IndeterminateCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  <SortTh label="Child"    field="name"     {...{ sortField, sortDir, toggleSort }} />
                  <SortTh label="Class"    field="class"    {...{ sortField, sortDir, toggleSort }} />
                  <SortTh label="Guardian" field="guardian" {...{ sortField, sortDir, toggleSort }} />
                  <SortTh label="Service"  field="service"  {...{ sortField, sortDir, toggleSort }} />
                  {showCheckout && (
                    <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Code</th>
                  )}
                  <SortTh label="In"  field="time"     {...{ sortField, sortDir, toggleSort }} />
                  {showCheckout && (
                    <SortTh label="Out" field="checkout" {...{ sortField, sortDir, toggleSort }} />
                  )}
                  <th className="px-3 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {checkins.map(c => {
                  const isActive      = !c.checked_out_at
                  const isSelecting   = selected.has(c.id)
                  const isDeleting    = pendingDelete   === c.id
                  const isCheckingOut = pendingCheckout === c.id

                  return (
                    <tr key={c.id} className={`transition-colors ${
                      isDeleting    ? 'bg-red-50 dark:bg-red-900/10' :
                      isCheckingOut ? 'bg-[var(--primary)]/5' :
                      isSelecting   ? 'bg-[var(--primary)]/5' :
                      'bg-[var(--card)] hover:bg-[var(--muted)]/40'
                    }`}>
                      <td className="px-3 py-3 text-center">
                        <input type="checkbox" checked={isSelecting} onChange={() => toggleRow(c.id)}
                          className="rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                            text-xs font-bold text-[var(--primary)] flex-shrink-0">
                            {c.person.first_name[0]}
                          </div>
                          <span className="font-medium text-[var(--foreground)]">
                            {c.person.first_name} {c.person.last_name}
                          </span>
                          {c.person.medical_notes && (
                            <span
                              title={c.person.medical_notes}
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full
                                bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400
                                flex-shrink-0 cursor-help"
                            >
                              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.classGroup
                          ? <span className="text-xs font-medium px-2 py-0.5 rounded-full
                              bg-[var(--primary)]/10 text-[var(--primary)]">{c.classGroup.name}</span>
                          : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.guardian_name || c.guardian_phone
                          ? <div>
                              {c.guardian_name && <p className="text-sm text-[var(--foreground)]">{c.guardian_name}</p>}
                              {c.guardian_phone && <p className="text-xs text-[var(--muted-foreground)]">{c.guardian_phone}</p>}
                            </div>
                          : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted-foreground)] text-sm">{c.service.name}</td>
                      {showCheckout && (
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-[var(--primary)] tracking-widest text-sm">
                            {c.pickup_code}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-[var(--muted-foreground)] text-sm">{fmtTime(c.checked_in_at)}</td>
                      {showCheckout && (
                        <td className="px-4 py-3 text-sm">
                          {c.checked_out_at
                            ? <span className="text-[var(--muted-foreground)]">{fmtTime(c.checked_out_at)}</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5
                                rounded-full bg-emerald-100 text-emerald-700
                                dark:bg-emerald-900/30 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Here
                              </span>}
                        </td>
                      )}
                      <td className="px-2 py-3 text-right">
                        <RowActions
                          isActive={isActive}
                          showCheckout={showCheckout}
                          isDeleting={isDeleting}
                          isCheckingOut={isCheckingOut}
                          deleting={deleting}
                          checkingOut={checkingOut}
                          onCheckout={() => setPendingCheckout(c.id)}
                          onCheckoutConfirm={() => { checkOutMutation({ variables: { checkinId: c.id } }); setPendingCheckout(null) }}
                          onDelete={() => setPendingDelete(c.id)}
                          onDeleteConfirm={() => deleteCheckin({ variables: { checkinId: c.id } })}
                          onCancel={() => { setPendingDelete(null); setPendingCheckout(null) }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--muted)]/30
              text-xs text-[var(--muted-foreground)]">
              {checkins.length} record{checkins.length !== 1 ? 's' : ''}
              {(filterServiceId || filterClassId || q) ? ' (filtered)' : ''}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function BatchBar({ count, activeCount, showCheckout, loading, onCheckout, onDelete, onClear }) {
  return (
    <div className="mb-3 flex items-center gap-2 flex-wrap px-3 py-2.5 rounded-lg
      bg-[var(--primary)]/5 border border-[var(--primary)]/20">
      <span className="text-sm font-medium text-[var(--primary)] mr-1">
        {count} selected
      </span>
      {showCheckout && activeCount > 0 && (
        <button onClick={onCheckout} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-xs font-semibold
            hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">
          {loading ? <Spinner sm /> : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7" />
            </svg>
          )}
          Check Out {activeCount > 1 ? `(${activeCount})` : ''}
        </button>
      )}
      <button onClick={onDelete} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300
          text-red-600 dark:border-red-700 dark:text-red-400 text-xs font-semibold
          hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
        {loading ? <Spinner sm /> : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
        Delete ({count})
      </button>
      <button onClick={onClear}
        className="ml-auto text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
        Clear selection
      </button>
    </div>
  )
}

function RowActions({ isActive, showCheckout, isDeleting, isCheckingOut, deleting, checkingOut,
  onCheckout, onCheckoutConfirm, onDelete, onDeleteConfirm, onCancel }) {
  if (isCheckingOut) return (
    <div className="flex items-center justify-end gap-1">
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
    <div className="flex items-center justify-end gap-1">
      <button onClick={onDeleteConfirm} disabled={deleting}
        className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold
          hover:bg-red-700 disabled:opacity-50 whitespace-nowrap">
        {deleting ? '…' : 'Remove'}
      </button>
      <button onClick={onCancel}
        className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
          text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
    </div>
  )
  return (
    <div className="flex items-center justify-end gap-0.5 sm:opacity-0 sm:[tr:hover_&]:opacity-100 transition-opacity">
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
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
      <div className="flex items-start justify-between mb-2 sm:mb-3 gap-1">
        <span className="text-[11px] sm:text-sm text-[var(--muted-foreground)] leading-tight">{label}</span>
        <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  )
}

function Spinner({ sm }) {
  return (
    <svg className={`animate-spin ${sm ? 'w-3.5 h-3.5' : 'w-6 h-6'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function MobileCheckinCard({
  c, showCheckout, isSelecting, isDeleting, isCheckingOut,
  deleting, checkingOut, onToggle, onCheckout, onCheckoutConfirm,
  onDelete, onDeleteConfirm, onCancel,
}) {
  const isActive = !c.checked_out_at
  return (
    <div className={`p-4 transition-colors ${
      isDeleting    ? 'bg-red-50 dark:bg-red-900/10' :
      isCheckingOut ? 'bg-[var(--primary)]/5' :
      isSelecting   ? 'bg-[var(--primary)]/5' :
      'bg-[var(--card)]'
    }`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelecting}
          onChange={() => onToggle(c.id)}
          className="mt-1 rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                text-xs font-bold text-[var(--primary)] flex-shrink-0">
                {c.person.first_name[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-[var(--foreground)] text-sm">
                    {c.person.first_name} {c.person.last_name}
                  </p>
                  {c.person.medical_notes && (
                    <span title={c.person.medical_notes}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full
                        bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 cursor-help flex-shrink-0">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                  {showCheckout && (
                    isActive
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5
                          rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                          Here
                        </span>
                      : <span className="text-[10px] text-[var(--muted-foreground)]">
                          Out {fmtTime(c.checked_out_at)}
                        </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                  {c.service.name}{c.classGroup ? ` · ${c.classGroup.name}` : ''}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            {!isDeleting && !isCheckingOut && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {showCheckout && isActive && (
                  <button onClick={onCheckout} title="Check out"
                    className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--primary)]
                      hover:bg-[var(--primary)]/10 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
                    </svg>
                  </button>
                )}
                <button onClick={onDelete} title="Remove record"
                  className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-red-500
                    hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
            {c.guardian_name && <span>{c.guardian_name}</span>}
            {showCheckout && c.pickup_code && (
              <span className="font-mono font-bold text-[var(--primary)] tracking-widest">
                {c.pickup_code}
              </span>
            )}
            <span>{fmtTime(c.checked_in_at)}</span>
          </div>

          {/* Inline confirm */}
          {isCheckingOut && (
            <div className="mt-2 flex items-center gap-2">
              <button onClick={onCheckoutConfirm} disabled={checkingOut}
                className="px-3 py-1 rounded bg-[var(--primary)] text-[var(--primary-foreground)]
                  text-xs font-semibold hover:bg-[var(--primary)]/90 disabled:opacity-50">
                {checkingOut ? '…' : 'Confirm Check Out'}
              </button>
              <button onClick={onCancel}
                className="px-2 py-1 rounded border border-[var(--border)] text-xs
                  text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
            </div>
          )}
          {isDeleting && (
            <div className="mt-2 flex items-center gap-2">
              <button onClick={onDeleteConfirm} disabled={deleting}
                className="px-3 py-1 rounded bg-red-600 text-white text-xs font-semibold
                  hover:bg-red-700 disabled:opacity-50">
                {deleting ? '…' : 'Remove Record'}
              </button>
              <button onClick={onCancel}
                className="px-2 py-1 rounded border border-[var(--border)] text-xs
                  text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ClassSessionCard({ cls, staffList }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName]   = useState(cls.todaySession?.teacher_name  ?? '')
  const [phone, setPhone] = useState(cls.todaySession?.teacher_phone ?? '')
  const [phoneError, setPhoneError] = useState('')
  const [setSession, { loading }] = useMutation(SET_CLASS_SESSION_MUTATION, {
    refetchQueries: [{ query: TODAY_CLASS_SESSIONS_QUERY }],
    onCompleted: () => setShowForm(false),
  })
  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    if (!isValidPhone(phone)) {
      setPhoneError('Please enter a valid phone number (at least 7 digits).')
      return
    }
    setPhoneError('')
    await setSession({ variables: { classId: cls.id, teacherName: name.trim(), teacherPhone: phone.trim() || null } })
  }
  const session = cls.todaySession
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">{cls.name}</p>
          {session
            ? <div className="mt-1">
                <p className="text-sm text-[var(--foreground)]">{session.teacher_name}</p>
                {session.teacher_phone && <p className="text-xs text-[var(--muted-foreground)]">{session.teacher_phone}</p>}
              </div>
            : <p className="text-xs text-[var(--muted-foreground)] mt-1">No teacher assigned yet</p>}
        </div>
        <button
          onClick={() => { setName(session?.teacher_name ?? ''); setPhone(session?.teacher_phone ?? ''); setShowForm(v => !v) }}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)]
            text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
          {session ? 'Change' : 'Assign'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSave} className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
          <TeacherCombobox value={name} onChange={setName}
            onSelect={(s) => { setName(s.name); setPhone(s.phone ?? '') }} staffList={staffList} />
          <PhoneInput
            value={phone}
            onChange={val => { setPhone(val); setPhoneError('') }}
          />
          {phoneError && <p className="text-[11px] text-[var(--destructive)]">{phoneError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-1.5 rounded-lg border border-[var(--border)] text-xs
                text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex-1 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                text-xs font-semibold hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function TeacherCombobox({ value, onChange, onSelect, staffList }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const filtered = value.trim().length > 0
    ? staffList.filter(u => u.name.toLowerCase().includes(value.trim().toLowerCase()))
    : staffList
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  return (
    <div ref={containerRef} className="relative">
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} placeholder="Teacher name *" required autoFocus
        className={sessionInput} autoComplete="off" />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-[var(--border)]
          bg-[var(--card)] shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map(u => (
            <button key={u.id} type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(u); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left
                hover:bg-[var(--primary)]/5 transition-colors">
              <div className="w-6 h-6 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                text-[10px] font-bold text-[var(--primary)] flex-shrink-0">{u.name[0].toUpperCase()}</div>
              <p className="text-sm font-medium text-[var(--foreground)] truncate flex-1">{u.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)]
                text-[var(--muted-foreground)] flex-shrink-0">
                {{ TEACHER: 'Teacher', ADMIN: 'Admin', VOLUNTEER: 'Volunteer' }[u.role] ?? u.role}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const sessionInput = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`

const filterSelect = `px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50
  focus:border-[var(--ring)] transition-colors cursor-pointer`
