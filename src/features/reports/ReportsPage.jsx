import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { ME_QUERY, ATTENDANCE_REPORT_QUERY, GUARDIAN_CONTACTS_QUERY } from '@/graphql/queries'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

const PRESETS = [
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

const TREND_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function buildTrendData(trendArr) {
  if (!trendArr?.length) return { data: [], names: [] }
  const periods = [...new Set(trendArr.map(t => t.period))].sort()
  const names   = [...new Set(trendArr.map(t => t.name))].sort()
  const data = periods.map(p => {
    const row = {
      period: new Date(p + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
    names.forEach(n => { row[n] = 0 })
    trendArr.filter(t => t.period === p).forEach(t => { row[t.name] = t.count })
    return row
  })
  return { data, names }
}

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

  const { data: meData } = useQuery(ME_QUERY)
  const { data: reportData, loading: reportLoading } = useQuery(ATTENDANCE_REPORT_QUERY, {
    variables: { startDate: range.start, endDate: range.end },
    skip: tab !== 'overview',
  })
  const { data: contactsData, loading: contactsLoading } = useQuery(GUARDIAN_CONTACTS_QUERY, {
    variables: { startDate: range.start, endDate: range.end },
    skip: tab !== 'contacts',
  })

  const report     = reportData?.attendanceReport
  const contacts   = contactsData?.guardianContacts ?? []
  const churchName = meData?.me?.church?.name ?? 'Kids Ministry'

  const days = Math.max(1, Math.ceil(
    (new Date(range.end) - new Date(range.start)) / (1000 * 60 * 60 * 24)
  ) + 1)

  function fmtDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function exportOverviewCSV() {
    if (!report) return
    const sections = [
      ['Summary'],
      ['Metric', 'Value'],
      ['Total Check-ins', report.total],
      ['Unique Children', report.unique_children],
      ['First-time Visitors', report.first_time_visitors],
      ['Avg per Day', report.avg_per_day],
      ['Days Tracked', days],
      [],
      ['Daily Breakdown'],
      ['Date', 'Check-ins'],
      ...report.by_day.map(d => [fmtDate(d.date), d.count]),
      [],
      ['By Class'],
      ['Class', 'Check-ins'],
      ...report.by_class.map(c => [c.class_name, c.count]),
      [],
      ['By Service'],
      ['Service', 'Check-ins'],
      ...report.by_service.map(s => [s.service_name, s.count]),
    ]
    const csv  = sections.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `attendance-report-${range.start}-${range.end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function printReport() {
    if (!report) return
    const rangeLabel = `${fmtDate(range.start)} – ${fmtDate(range.end)}`
    const timeStr    = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    function tableRows(data, keyA, keyB) {
      return data.map(r => `<tr><td>${r[keyA]}</td><td class="num">${r[keyB]}</td></tr>`).join('')
    }

    const byDayRows = report.by_day.map(d =>
      `<tr><td>${fmtDate(d.date)}</td><td class="num">${d.count}</td></tr>`
    ).join('')

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Attendance Report</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:32px;color:#0f172a;font-size:13px}
      .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1A3A8C}
      .header-left .org{font-size:11px;font-weight:700;color:#1A3A8C;text-transform:uppercase;letter-spacing:.1em}
      .header-left .title{font-size:22px;font-weight:800;color:#0f172a;margin-top:2px}
      .header-left .date{font-size:13px;color:#64748b;margin-top:3px}
      .header-right{text-align:right;font-size:11px;color:#94a3b8;line-height:1.8}
      .header-right strong{color:#64748b}
      .section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#1A3A8C;
        margin:28px 0 12px;padding-bottom:6px;border-bottom:1.5px solid #e2e8f0}
      .stat-row{display:flex;gap:14px;flex-wrap:wrap}
      .stat{flex:1;min-width:120px;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px 16px;break-inside:avoid}
      .stat .num{font-size:28px;font-weight:800;color:#1A3A8C}
      .stat .lbl{font-size:11px;color:#64748b;margin-top:2px}
      .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:0}
      .block{border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;break-inside:avoid}
      .block-header{padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;
        font-size:12px;font-weight:700;color:#0f172a}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{text-align:left;padding:6px 14px;font-size:10px;font-weight:600;text-transform:uppercase;
        letter-spacing:.05em;color:#64748b;background:#fafafa;border-bottom:1px solid #f1f5f9}
      td{padding:5px 14px;border-bottom:1px solid #f8fafc;vertical-align:middle}
      tr:last-child td{border-bottom:none}
      .num{text-align:right;font-weight:700;color:#1A3A8C}
      .pbar{display:flex;gap:8px;margin-bottom:20px}
      .pbtn{padding:8px 18px;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;font-weight:600}
      .pbtn-p{background:#1A3A8C;color:#fff;border:none}
      .pbtn-c{background:#fff;border:1.5px solid #e2e8f0;color:#334155}
      @media print{body{padding:16px}.grid-2{grid-template-columns:1fr 1fr}.pbar{display:none!important}}
    </style></head><body>
      <div class="pbar">
        <button class="pbtn pbtn-p" onclick="window.print();window.onafterprint=function(){window.close()}">Print</button>
        <button class="pbtn pbtn-c" onclick="window.close()">✕ Close</button>
      </div>
      <div class="header">
        <div class="header-left">
          <div class="org">${churchName}</div>
          <div class="title">Attendance Report</div>
          <div class="date">${rangeLabel}</div>
        </div>
        <div class="header-right">
          <div>Printed: <strong>${timeStr}</strong></div>
          <div>Total Check-ins: <strong>${report.total}</strong></div>
        </div>
      </div>

      <div class="section-label">Summary</div>
      <div class="stat-row">
        <div class="stat"><div class="num">${report.total}</div><div class="lbl">Total Check-ins</div></div>
        <div class="stat"><div class="num">${report.unique_children}</div><div class="lbl">Unique Children</div></div>
        <div class="stat"><div class="num">${report.first_time_visitors}</div><div class="lbl">First-time Visitors</div></div>
        <div class="stat"><div class="num">${report.avg_per_day}</div><div class="lbl">Avg per Day</div></div>
        <div class="stat"><div class="num">${days}</div><div class="lbl">Days Tracked</div></div>
      </div>

      ${report.by_day.length ? `
      <div class="section-label">Daily Breakdown</div>
      <div class="block">
        <table>
          <thead><tr><th>Date</th><th class="num">Check-ins</th></tr></thead>
          <tbody>${byDayRows}</tbody>
        </table>
      </div>` : ''}

      <div class="section-label">Breakdown</div>
      <div class="grid-2">
        ${report.by_class.length ? `
        <div class="block">
          <div class="block-header">By Class</div>
          <table>
            <thead><tr><th>Class</th><th class="num">Kids</th></tr></thead>
            <tbody>${tableRows(report.by_class, 'class_name', 'count')}</tbody>
          </table>
        </div>` : ''}
        ${report.by_service.length ? `
        <div class="block">
          <div class="block-header">By Service</div>
          <table>
            <thead><tr><th>Service</th><th class="num">Kids</th></tr></thead>
            <tbody>${tableRows(report.by_service, 'service_name', 'count')}</tbody>
          </table>
        </div>` : ''}
      </div>

    </body></html>`)
    win.document.close()
  }

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

  function printContacts() {
    if (!contacts.length) return
    const rangeLabel = `${fmtDate(range.start)} – ${fmtDate(range.end)}`
    const timeStr    = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const rows = contacts.map(c => `
      <tr>
        <td>${c.child_name}</td>
        <td>${c.class_name ?? '—'}</td>
        <td>${c.guardian_name ?? '—'}</td>
        <td>${c.guardian_phone ?? '—'}</td>
        <td>${new Date(c.last_visit).toLocaleDateString()}</td>
        <td class="num">${c.visit_count}</td>
      </tr>`).join('')
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Guardian Contacts</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:32px;color:#0f172a;font-size:13px}
      .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1A3A8C}
      .header-left .org{font-size:11px;font-weight:700;color:#1A3A8C;text-transform:uppercase;letter-spacing:.1em}
      .header-left .title{font-size:22px;font-weight:800;color:#0f172a;margin-top:2px}
      .header-left .date{font-size:13px;color:#64748b;margin-top:3px}
      .header-right{text-align:right;font-size:11px;color:#94a3b8;line-height:1.8}
      .header-right strong{color:#64748b}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
      th{text-align:left;padding:8px 12px;font-size:10px;font-weight:600;text-transform:uppercase;
        letter-spacing:.05em;color:#64748b;background:#f8fafc;border-bottom:2px solid #e2e8f0}
      td{padding:7px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155}
      tr:last-child td{border-bottom:none}
      tr:nth-child(even) td{background:#fafafa}
      .num{text-align:right;font-weight:700;color:#1A3A8C}
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
          <div class="title">Guardian Contacts</div>
          <div class="date">${rangeLabel}</div>
        </div>
        <div class="header-right">
          <div>Printed: <strong>${timeStr}</strong></div>
          <div>Total: <strong>${contacts.length} families</strong></div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Child</th><th>Class</th><th>Guardian</th>
            <th>Phone</th><th>Last Visit</th><th class="num">Visits</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`)
    win.document.close()
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
            className={inputClass + ' w-36 pr-8'} />
          <span className="text-[var(--muted-foreground)] text-sm">–</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            className={inputClass + ' w-36 pr-8'} />
        </div>
        {tab === 'overview' && report && (
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={printReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)]
                text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]
                hover:border-[var(--primary)]/50 transition-colors">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Report
            </button>
            <button onClick={exportOverviewCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)]
                text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]
                hover:border-[var(--primary)]/50 transition-colors">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>
        )}
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
        <OverviewTab report={report} loading={reportLoading} range={range} days={days} />
      )}
      {tab === 'contacts' && (
        <ContactsTab contacts={contacts} loading={contactsLoading} onExport={exportContacts} onPrint={printContacts} />
      )}
    </div>
  )
}

function TrendChart({ data, names, height = 220 }) {
  const tooltipStyle = {
    contentStyle: {
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      fontSize: '12px',
    },
    labelStyle: { color: 'var(--foreground)', fontWeight: 600 },
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
        {names.map((name, i) => (
          <Line key={name} type="monotone" dataKey={name}
            stroke={TREND_COLORS[i % TREND_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: TREND_COLORS[i % TREND_COLORS.length] }}
            activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function OverviewTab({ report, loading, range, days }) {
  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!report)  return null

  const chartData = report.by_day.map(d => ({
    date:  new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: d.count,
  }))

  const serviceTrend = buildTrendData(report.trend_by_service)
  const classTrend   = buildTrendData(report.trend_by_class)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Check-ins" value={report.total}
          hint="Every check-in event, including children who attended more than one service." />
        <MetricCard label="Unique Children" value={report.unique_children}
          hint="Distinct children who attended — each child counted once no matter how many services they went to." />
        <MetricCard label="First-time Visitors" value={report.first_time_visitors}
          hint="Children checking in for the very first time ever — they had no previous visits before this period." />
        <MetricCard label="Avg per Day" value={report.avg_per_day}
          hint="Average total check-ins per day across the selected period." />
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
          <ChartCard title="By Class — Total">
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
          <ChartCard title="By Service — Total">
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

      {/* Trend over time — per service */}
      {serviceTrend.data.length >= 2 && (
        <ChartCard title="Service Attendance Trend">
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            How each service's check-in count changed over the selected period
          </p>
          <TrendChart data={serviceTrend.data} names={serviceTrend.names} />
        </ChartCard>
      )}

      {/* Trend over time — per class */}
      {classTrend.data.length >= 2 && (
        <ChartCard title="Class Attendance Trend">
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            How each class's check-in count changed over the selected period
          </p>
          <TrendChart data={classTrend.data} names={classTrend.names} />
        </ChartCard>
      )}
    </div>
  )
}

function ContactsTab({ contacts, loading, onExport, onPrint }) {
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

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={onPrint} disabled={!contacts.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)]
              text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]
              hover:border-[var(--primary)]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
          <button onClick={onExport} disabled={!contacts.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)]
              text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]
              hover:border-[var(--primary)]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
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

function MetricCard({ label, value, hint }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-sm text-[var(--muted-foreground)]">{label}</p>
        {hint && (
          <span className="relative group/hint flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]/50 cursor-help"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
              w-52 rounded-lg bg-[var(--foreground)] text-[var(--background)]
              text-xs px-2.5 py-1.5 opacity-0 group-hover/hint:opacity-100 transition-opacity
              z-50 shadow-sm text-center leading-relaxed">
              {hint}
            </span>
          </span>
        )}
      </div>
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
