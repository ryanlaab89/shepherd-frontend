import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { ATTENDANCE_REPORT_QUERY, GUARDIAN_CONTACTS_QUERY } from '@/graphql/queries'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'

const PRESETS = [
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

function toISODate(d) {
  return d.toISOString().split('T')[0]
}

function dateRange(days) {
  const end   = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  return { start: toISODate(start), end: toISODate(end) }
}

export default function ReportsPage() {
  const [preset, setPreset] = useState(1) // index into PRESETS
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState('')
  const [tab, setTab] = useState('overview') // 'overview' | 'contacts'

  const useCustom = customStart && customEnd
  const range = useCustom
    ? { start: customStart, end: customEnd }
    : dateRange(PRESETS[preset].days)

  const { data: reportData, loading: reportLoading } = useQuery(ATTENDANCE_REPORT_QUERY, {
    variables: { startDate: range.start, endDate: range.end },
    skip: tab !== 'overview',
  })
  const { data: contactsData, loading: contactsLoading } = useQuery(GUARDIAN_CONTACTS_QUERY, {
    variables: { startDate: range.start, endDate: range.end },
    skip: tab !== 'contacts',
  })

  const report   = reportData?.attendanceReport
  const contacts = contactsData?.guardianContacts ?? []

  function exportContacts() {
    const header = 'Child,Class,Guardian,Phone,Last Visit,Visits'
    const rows = contacts.map(c => [
      `"${c.child_name}"`,
      `"${c.class_name ?? ''}"`,
      `"${c.guardian_name ?? ''}"`,
      `"${c.guardian_phone ?? ''}"`,
      new Date(c.last_visit).toLocaleDateString(),
      c.visit_count,
    ].join(','))
    const csv  = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `guardian-contacts-${range.start}-${range.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Reports</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Attendance metrics and guardian contacts
        </p>
      </div>

      {/* Date range controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {PRESETS.map((p, i) => (
          <button key={p.label}
            onClick={() => { setPreset(i); setCustomStart(''); setCustomEnd('') }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !useCustom && preset === i
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/70'
            }`}>
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-2">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
            className={inputClass + ' w-36'} />
          <span className="text-[var(--muted-foreground)] text-sm">–</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            className={inputClass + ' w-36'} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg bg-[var(--muted)] w-fit">
        {[['overview', 'Overview'], ['contacts', 'Guardian Contacts']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab report={report} loading={reportLoading} range={range} />
      )}
      {tab === 'contacts' && (
        <ContactsTab contacts={contacts} loading={contactsLoading} onExport={exportContacts} />
      )}
    </div>
  )
}

function OverviewTab({ report, loading, range }) {
  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!report)  return null

  const days = Math.max(1, Math.ceil(
    (new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60 * 24)
  ) + 1)

  const chartData = report.by_day.map(d => ({
    date:  new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: d.count,
  }))

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Check-ins" value={report.total} />
        <MetricCard label="Avg per Day" value={report.avg_per_day} />
        <MetricCard label="Days Tracked" value={days} />
      </div>

      {/* Daily trend */}
      {chartData.length > 0 ? (
        <ChartCard title="Daily Attendance">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--primary)' }}
              />
              <Line type="monotone" dataKey="count" name="Check-ins"
                stroke="var(--primary)" strokeWidth={2}
                dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
                activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">No check-ins in this period</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        {/* By class */}
        {report.by_class.length > 0 && (
          <ChartCard title="By Class">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={report.by_class} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="class_name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '8px', fontSize: '12px',
                }} />
                <Bar dataKey="count" name="Check-ins" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* By service */}
        {report.by_service.length > 0 && (
          <ChartCard title="By Service">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={report.by_service} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="service_name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: '8px', fontSize: '12px',
                }} />
                <Bar dataKey="count" name="Check-ins" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </div>
  )
}

function ContactsTab({ contacts, loading, onExport }) {
  const [search,       setSearch]       = useState('')
  const [filterClass,  setFilterClass]  = useState('')
  const [sortField,    setSortField]    = useState('child_name')
  const [sortDir,      setSortDir]      = useState('asc')

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  // Unique class names for filter
  const classOptions = [...new Set(contacts.map(c => c.class_name).filter(Boolean))].sort()

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'visit_count' ? 'desc' : 'asc')
    }
  }

  const q = search.trim().toLowerCase()
  let filtered = contacts

  if (filterClass) filtered = filtered.filter(c => c.class_name === filterClass)
  if (q) filtered = filtered.filter(c =>
    c.child_name.toLowerCase().includes(q) ||
    (c.guardian_name ?? '').toLowerCase().includes(q) ||
    (c.guardian_phone ?? '').includes(q)
  )

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortField === 'child_name')   cmp = a.child_name.localeCompare(b.child_name)
    if (sortField === 'last_visit')   cmp = new Date(a.last_visit) - new Date(b.last_visit)
    if (sortField === 'visit_count')  cmp = a.visit_count - b.visit_count
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Class filter */}
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className={inputClass + ' w-auto cursor-pointer'}
        >
          <option value="">All classes</option>
          {classOptions.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {/* Name / phone search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className={inputClass + ' pl-9'} />
        </div>

        <button onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)]
            text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-[var(--border)]">
          <p className="text-sm text-[var(--muted-foreground)]">
            {contacts.length === 0 ? 'No check-ins in this period' : 'No results for current filters'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                <ReportSortHeader label="Child"      field="child_name"  sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Class</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Guardian</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Phone</th>
                <ReportSortHeader label="Last Visit" field="last_visit"  sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <ReportSortHeader label="Visits"     field="visit_count" sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((c, i) => (
                <tr key={i} className="bg-[var(--card)] hover:bg-[var(--muted)]/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{c.child_name}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{c.class_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{c.guardian_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{c.guardian_phone ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {new Date(c.last_visit).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--primary)]">{c.visit_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ReportSortHeader({ label, field, sortField, sortDir, onSort, align = 'left' }) {
  const active = sortField === field
  return (
    <th className={`px-4 py-3 font-medium text-[var(--muted-foreground)] text-${align}`}>
      <button
        onClick={() => onSort(field)}
        className={`flex items-center gap-1 hover:text-[var(--foreground)] transition-colors
          ${align === 'right' ? 'ml-auto' : ''}
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

function MetricCard({ label, value }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <p className="text-sm text-[var(--muted-foreground)] mb-2">{label}</p>
      <p className="text-3xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <p className="text-sm font-semibold text-[var(--foreground)] mb-4">{title}</p>
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

const inputClass = `px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`
