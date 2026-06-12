import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import {
  DASHBOARD_QUERY,
  ACTIVE_CHECKINS_QUERY,
  TODAY_CHECKINS_QUERY,
  CHURCH_SETTINGS_QUERY,
  TODAY_CLASS_SESSIONS_QUERY,
  SERVICES_QUERY,
  USERS_QUERY,
} from '@/graphql/queries'
import { SET_CLASS_SESSION_MUTATION, DELETE_CHECKIN_MUTATION } from '@/graphql/mutations'
import { detectActiveService } from '@/lib/serviceUtils'

export default function DashboardPage() {
  const [search,          setSearch]          = useState('')
  const [filterServiceId, setFilterServiceId] = useState('')
  const [filterClassId,   setFilterClassId]   = useState('')
  const [sortField,       setSortField]       = useState('time')   // 'time' | 'name'
  const [sortDir,         setSortDir]         = useState('desc')   // 'asc' | 'desc'
  const [autoService,     setAutoService]     = useState(null)     // service ID auto-detected
  const [pendingDelete,   setPendingDelete]   = useState(null)     // checkin id awaiting confirm
  const navigate = useNavigate()

  const { data: classData } = useQuery(TODAY_CLASS_SESSIONS_QUERY, { pollInterval: 60000 })
  const classes = classData?.todayClassSessions ?? []

  const { data: usersData }    = useQuery(USERS_QUERY)
  const staffList = usersData?.users ?? []

  const { data: servicesData } = useQuery(SERVICES_QUERY)
  const allServices = servicesData?.services ?? []

  const { data: statsData,  loading: statsLoading } = useQuery(DASHBOARD_QUERY,       { pollInterval: 30000 })
  const { data: settingsData                       } = useQuery(CHURCH_SETTINGS_QUERY, { fetchPolicy: 'cache-first' })

  const showCheckout = settingsData?.churchSettings?.show_checkout ?? true

  const { data: activeData, loading: activeLoading } = useQuery(ACTIVE_CHECKINS_QUERY, {
    pollInterval: 15000,
    skip: !showCheckout,
  })
  const { data: todayData,  loading: todayLoading  } = useQuery(TODAY_CHECKINS_QUERY, {
    pollInterval: 15000,
    skip: showCheckout,
  })

  const [deleteCheckin, { loading: deleting }] = useMutation(DELETE_CHECKIN_MUTATION, {
    refetchQueries: [
      { query: ACTIVE_CHECKINS_QUERY },
      { query: TODAY_CHECKINS_QUERY },
      { query: DASHBOARD_QUERY },
    ],
    onCompleted: () => setPendingDelete(null),
  })

  const stats    = statsData?.dashboard
  const rawList  = showCheckout ? (activeData?.activeCheckins ?? []) : (todayData?.todayCheckins ?? [])
  const listLoading = showCheckout ? activeLoading : todayLoading

  // Auto-detect current service on mount and whenever services load
  useEffect(() => {
    const result = detectActiveService(allServices)
    const id = result?.service?.id ?? null
    setAutoService(id)
    if (id && filterServiceId === '') {
      setFilterServiceId(id)
    }
  }, [allServices.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Unique services and classes present in today's list (for filter options)
  const serviceOptions = Array.from(
    new Map(rawList.map(c => [c.service.id, c.service])).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const classOptions = Array.from(
    new Map(
      rawList
        .filter(c => c.classGroup)
        .map(c => [c.classGroup.id, c.classGroup])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  // Filter + sort pipeline
  const q = search.trim().toLowerCase()
  let checkins = rawList

  if (filterServiceId) checkins = checkins.filter(c => c.service.id === filterServiceId)
  if (filterClassId)   checkins = checkins.filter(c => c.classGroup?.id === filterClassId)
  if (q)               checkins = checkins.filter(c =>
    `${c.person.first_name} ${c.person.last_name}`.toLowerCase().includes(q)
  )

  checkins = [...checkins].sort((a, b) => {
    let cmp = 0
    if (sortField === 'name') {
      cmp = `${a.person.first_name} ${a.person.last_name}`
        .localeCompare(`${b.person.first_name} ${b.person.last_name}`)
    } else {
      cmp = new Date(a.checked_in_at) - new Date(b.checked_in_at)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'time' ? 'desc' : 'asc')
    }
  }

  const totalToday  = stats?.total_today          ?? 0
  const currentlyIn = stats?.currently_checked_in ?? 0
  const checkedOut  = totalToday - currentlyIn

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
        <button
          onClick={() => navigate('/checkin')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-sm font-semibold flex-shrink-0 whitespace-nowrap
            hover:bg-[var(--primary)]/90 active:scale-95 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Check In
        </button>
      </div>

      {/* Stat cards */}
      <div className={`grid grid-cols-1 gap-4 mb-8 ${showCheckout ? 'sm:grid-cols-3' : 'sm:grid-cols-1 max-w-xs'}`}>
        <StatCard
          label="Checked In Today"
          value={statsLoading ? '—' : totalToday}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="primary"
        />
        {showCheckout && (
          <>
            <StatCard
              label="Still Here"
              value={statsLoading ? '—' : currentlyIn}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              color="accent"
            />
            <StatCard
              label="Checked Out"
              value={statsLoading ? '—' : checkedOut}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
              color="muted"
            />
          </>
        )}
      </div>

      {/* Today's Classes */}
      {classes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Today's Classes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {classes.map(cls => (
              <ClassSessionCard key={cls.id} cls={cls} staffList={staffList} />
            ))}
          </div>
        </div>
      )}

      {/* By service */}
      {stats?.by_service?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Active by Service</h2>
          <div className="flex flex-wrap gap-2">
            {stats.by_service.map((row) => (
              <div key={row.service_name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
                <span className="text-sm text-[var(--foreground)]">{row.service_name}</span>
                <span className="text-sm font-bold text-[var(--primary)]">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance table */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {showCheckout ? 'Currently Checked In' : "Today's Attendance"}
          </h2>
          <span className="text-xs text-[var(--muted-foreground)]">Auto-refreshes every 15s</span>
        </div>

        {/* Filter + search bar */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Service filter */}
          <div className="relative">
            <select
              value={filterServiceId}
              onChange={e => setFilterServiceId(e.target.value)}
              className={filterSelect}
            >
              <option value="">All services</option>
              {serviceOptions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {isAutoService && (
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 py-0.5 rounded-full
                bg-[var(--primary)] text-[var(--primary-foreground)] leading-none pointer-events-none">
                Auto
              </span>
            )}
          </div>

          {/* Class filter */}
          <select
            value={filterClassId}
            onChange={e => setFilterClassId(e.target.value)}
            className={filterSelect}
          >
            <option value="">All classes</option>
            {classOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Name search */}
          <div className="relative flex-1 min-w-[160px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
                text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]
                focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {(filterServiceId || filterClassId) && (
            <button
              onClick={() => { setFilterServiceId(''); setFilterClassId('') }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[var(--border)]
                text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)]
                hover:border-[var(--destructive)]/40 transition-colors"
              title="Clear filters"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>

        {listLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--muted-foreground)]">
            <Spinner />
          </div>
        ) : checkins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-xl">
            <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-sm">
              {(q || filterServiceId || filterClassId)
                ? 'No children match the current filters'
                : 'No children checked in yet'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                  <SortHeader label="Child"      field="name" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Class</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Guardian</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Service</th>
                  {showCheckout && (
                    <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Code</th>
                  )}
                  <SortHeader label="Checked In" field="time" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {checkins.map((c) => {
                  const isConfirming = pendingDelete === c.id
                  return (
                  <tr key={c.id} className={`bg-[var(--card)] transition-colors
                    ${isConfirming ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-[var(--muted)]/40'}`}>
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                      {c.person.first_name} {c.person.last_name}
                    </td>
                    <td className="px-4 py-3">
                      {c.classGroup
                        ? <span className="text-xs font-medium px-2 py-0.5 rounded-full
                            bg-[var(--primary)]/10 text-[var(--primary)]">{c.classGroup.name}</span>
                        : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.guardian_name || c.guardian_phone ? (
                        <div>
                          {c.guardian_name && (
                            <p className="text-sm text-[var(--foreground)]">{c.guardian_name}</p>
                          )}
                          {c.guardian_phone && (
                            <p className="text-xs text-[var(--muted-foreground)]">{c.guardian_phone}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{c.service.name}</td>
                    {showCheckout && (
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-[var(--primary)] tracking-widest">
                          {c.pickup_code}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">
                      {new Date(c.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {isConfirming ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => deleteCheckin({ variables: { checkinId: c.id } })}
                            disabled={deleting}
                            className="px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-medium
                              hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {deleting ? '…' : 'Remove'}
                          </button>
                          <button
                            onClick={() => setPendingDelete(null)}
                            className="px-2.5 py-1 rounded-md border border-[var(--border)] text-xs
                              text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPendingDelete(c.id)}
                          title="Remove this check-in (mistake correction)"
                          className="p-1.5 rounded-md text-[var(--muted-foreground)] opacity-40
                            hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
                            transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field
  return (
    <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">
      <button
        onClick={() => onSort(field)}
        className={`flex items-center gap-1 hover:text-[var(--foreground)] transition-colors
          ${active ? 'text-[var(--foreground)]' : ''}`}
      >
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

function ClassSessionCard({ cls, staffList }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName]   = useState(cls.todaySession?.teacher_name  ?? '')
  const [phone, setPhone] = useState(cls.todaySession?.teacher_phone ?? '')

  const [setSession, { loading }] = useMutation(SET_CLASS_SESSION_MUTATION, {
    refetchQueries: [{ query: TODAY_CLASS_SESSIONS_QUERY }],
    onCompleted: () => setShowForm(false),
  })

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    await setSession({ variables: { classId: cls.id, teacherName: name.trim(), teacherPhone: phone.trim() || null } })
  }

  const session = cls.todaySession

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">{cls.name}</p>
          {session ? (
            <div className="mt-1">
              <p className="text-sm text-[var(--foreground)]">{session.teacher_name}</p>
              {session.teacher_phone && (
                <p className="text-xs text-[var(--muted-foreground)]">{session.teacher_phone}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted-foreground)] mt-1">No teacher assigned yet</p>
          )}
        </div>
        <button
          onClick={() => { setName(session?.teacher_name ?? ''); setPhone(session?.teacher_phone ?? ''); setShowForm(v => !v) }}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)]
            text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
        >
          {session ? 'Change' : 'Assign'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
          <TeacherCombobox
            value={name}
            onChange={setName}
            onSelect={(staff) => { setName(staff.name); setPhone(staff.phone ?? '') }}
            staffList={staffList}
          />
          <input
            value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="Phone (optional)" type="tel"
            className={sessionInput}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-1.5 rounded-lg border border-[var(--border)] text-xs
                text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
              Cancel
            </button>
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

  const roleBadge = { TEACHER: 'Teacher', ADMIN: 'Admin', VOLUNTEER: 'Volunteer' }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Teacher name *"
        required
        autoFocus
        className={sessionInput}
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-[var(--border)]
          bg-[var(--card)] shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map(u => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(u); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left
                hover:bg-[var(--primary)]/5 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                text-[10px] font-bold text-[var(--primary)] flex-shrink-0">
                {u.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">{u.name}</p>
                {u.phone && <p className="text-xs text-[var(--muted-foreground)] truncate">{u.phone}</p>}
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)]
                text-[var(--muted-foreground)] flex-shrink-0">
                {roleBadge[u.role] ?? u.role}
              </span>
            </button>
          ))}
          {value.trim().length > 0 && !staffList.some(u => u.name.toLowerCase() === value.trim().toLowerCase()) && (
            <div className="px-3 py-2 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted-foreground)] italic">
                Press Save to use "{value.trim()}" as a guest teacher
              </p>
            </div>
          )}
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

function StatCard({ label, value, icon, color }) {
  const colors = {
    primary: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    accent:  'bg-[var(--accent)]/10 text-[var(--accent)]',
    muted:   'bg-[var(--muted)] text-[var(--muted-foreground)]',
  }
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
