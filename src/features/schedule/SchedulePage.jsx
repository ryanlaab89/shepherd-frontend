import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { useAuth } from '@/features/auth/AuthContext'
import { ME_QUERY,
  SCHEDULES_QUERY, MY_SCHEDULE_QUERY,
  SERVICES_QUERY, CLASSES_QUERY, USERS_QUERY,
  ASSIGN_TEACHER_MUTATION, REMOVE_TEACHER_MUTATION, SET_LEAD_MUTATION,
} from '@/graphql/queries'

function getUpcomingSunday() {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? 0 : 7 - day
  const d = new Date(today)
  d.setDate(today.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export default function SchedulePage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const [date, setDate] = useState(getUpcomingSunday)
  const [activeCell, setActiveCell] = useState(null)
  const [addUserId, setAddUserId] = useState('')
  const [addIsLead, setAddIsLead] = useState(false)

  const { data: schedulesData, refetch: refetchSchedules } = useQuery(SCHEDULES_QUERY, {
    variables: { date },
    skip: !isAdmin,
    fetchPolicy: 'cache-and-network',
  })
  const { data: servicesData } = useQuery(SERVICES_QUERY, { skip: !isAdmin })
  const { data: classesData }  = useQuery(CLASSES_QUERY,  { skip: !isAdmin })
  const { data: usersData }    = useQuery(USERS_QUERY,    { skip: !isAdmin })
  const { data: myScheduleData } = useQuery(MY_SCHEDULE_QUERY, { skip: isAdmin, fetchPolicy: 'cache-and-network' })
  const { data: meData }         = useQuery(ME_QUERY)

  const [assignTeacher, { loading: assigning }] = useMutation(ASSIGN_TEACHER_MUTATION)
  const [removeTeacher, { loading: removing }]  = useMutation(REMOVE_TEACHER_MUTATION)
  const [setLead,       { loading: settingLead }] = useMutation(SET_LEAD_MUTATION)

  const schedules  = schedulesData?.schedules   ?? []
  const services   = servicesData?.services     ?? []
  const classes    = classesData?.classes       ?? []
  const users      = usersData?.users           ?? []
  const mySchedule = myScheduleData?.mySchedule ?? []

  const scheduleMap = useMemo(() => {
    const map = {}
    for (const s of schedules) {
      const key = `${s.classGroup.id}_${s.service.id}`
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return map
  }, [schedules])

  const cellTeachers = activeCell
    ? (scheduleMap[`${activeCell.classId}_${activeCell.serviceId}`] ?? []).sort((a, b) => b.is_lead - a.is_lead)
    : []

  const availableUsers = users.filter(u => u.is_active && !cellTeachers.some(t => t.user.id === u.id))

  const myGrouped = useMemo(() => {
    const map = {}
    for (const s of mySchedule) {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [mySchedule])

  async function handleAssign() {
    if (!addUserId) return
    await assignTeacher({
      variables: { classId: activeCell.classId, serviceId: activeCell.serviceId, userId: addUserId, date, isLead: addIsLead },
    })
    setAddUserId('')
    setAddIsLead(false)
    refetchSchedules()
  }

  async function handleRemove(scheduleId) {
    await removeTeacher({ variables: { scheduleId } })
    refetchSchedules()
  }

  async function handleToggleLead(t) {
    if (t.is_lead) {
      await assignTeacher({
        variables: { classId: activeCell.classId, serviceId: activeCell.serviceId, userId: t.user.id, date, isLead: false },
      })
    } else {
      await setLead({ variables: { scheduleId: t.id } })
    }
    refetchSchedules()
  }

  const mutating = assigning || removing || settingLead
  const churchName = meData?.me?.church?.name ?? 'Kids Ministry'

  function exportScheduleCSV() {
    if (!schedules.length) return
    const headers = ['Date', 'Service', 'Time', 'Class', 'Teacher', 'Role']
    const rows = [...schedules]
      .sort((a, b) => a.service.name.localeCompare(b.service.name) || a.classGroup.name.localeCompare(b.classGroup.name))
      .map(s => [
        s.date,
        s.service.name,
        s.service.start_time ? formatTime(s.service.start_time) : '',
        s.classGroup.name,
        s.user.name,
        s.is_lead ? 'Lead' : 'Volunteer',
      ])
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `schedule-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function printSchedule() {
    if (!schedules.length) return
    const dateStr = formatDate(date)

    // Build maps
    const svcMap = {}   // serviceId -> classId -> Schedule[]
    const classMap = {} // classId   -> serviceId -> Schedule[]
    for (const s of schedules) {
      if (!svcMap[s.service.id]) svcMap[s.service.id] = {}
      if (!svcMap[s.service.id][s.classGroup.id]) svcMap[s.service.id][s.classGroup.id] = []
      svcMap[s.service.id][s.classGroup.id].push(s)
      if (!classMap[s.classGroup.id]) classMap[s.classGroup.id] = {}
      if (!classMap[s.classGroup.id][s.service.id]) classMap[s.classGroup.id][s.service.id] = []
      classMap[s.classGroup.id][s.service.id].push(s)
    }

    function teacherTag(t) {
      return `<span class="${t.is_lead ? 'lead' : 'vol'}">${t.is_lead ? '★ ' : ''}${t.user.name}</span>`
    }

    // Section 1: by service
    const byServiceHtml = services.map(svc => {
      const clsRows = classes.map(cls => {
        const teachers = (svcMap[svc.id]?.[cls.id] ?? []).sort((a, b) => b.is_lead - a.is_lead)
        const cell = teachers.length
          ? teachers.map(teacherTag).join(', ')
          : '<span class="empty">—</span>'
        return `<tr><td>${cls.name}</td><td>${cell}</td></tr>`
      }).join('')
      return `
        <div class="block">
          <div class="block-header">
            <span class="block-title">${svc.name}</span>
            ${svc.start_time ? `<span class="block-sub">${formatTime(svc.start_time)}</span>` : ''}
          </div>
          <table><thead><tr><th>Class</th><th>Teacher(s)</th></tr></thead>
          <tbody>${clsRows}</tbody></table>
        </div>`
    }).join('')

    // Section 2: by class (staff grouped per class)
    const byClassHtml = classes.map(cls => {
      const svcRows = services.map(svc => {
        const teachers = (classMap[cls.id]?.[svc.id] ?? []).sort((a, b) => b.is_lead - a.is_lead)
        if (!teachers.length) return ''
        return `<tr><td>${svc.name}${svc.start_time ? ` <span class="sub">${formatTime(svc.start_time)}</span>` : ''}</td><td>${teachers.map(teacherTag).join(', ')}</td></tr>`
      }).filter(Boolean).join('')
      if (!svcRows) return ''
      return `
        <div class="block">
          <div class="block-header"><span class="block-title">${cls.name}</span></div>
          <table><thead><tr><th>Service</th><th>Teacher(s)</th></tr></thead>
          <tbody>${svcRows}</tbody></table>
        </div>`
    }).filter(Boolean).join('')

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Schedule — ${dateStr}</title><style>
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
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
      .block{border:1.5px solid #e2e8f0;border-radius:10px;overflow:hidden;break-inside:avoid}
      .block-header{display:flex;align-items:baseline;justify-content:space-between;padding:10px 14px;
        background:#f8fafc;border-bottom:1px solid #e2e8f0}
      .block-title{font-size:13px;font-weight:700;color:#0f172a}
      .block-sub{font-size:11px;color:#64748b}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{text-align:left;padding:6px 14px;font-weight:600;font-size:10px;text-transform:uppercase;
        letter-spacing:.05em;color:#64748b;background:#fafafa;border-bottom:1px solid #f1f5f9}
      td{padding:6px 14px;border-bottom:1px solid #f8fafc;vertical-align:middle}
      tr:last-child td{border-bottom:none}
      .lead{font-weight:700;color:#1A3A8C}
      .vol{color:#334155}
      .empty{color:#cbd5e1}
      .sub{color:#94a3b8;font-size:10px}
      @media print{body{padding:16px}.grid{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}}
    </style></head><body>
      <div class="header">
        <div class="header-left">
          <div class="org">${churchName}</div>
          <div class="title">Kids Ministry Schedule</div>
          <div class="date">${dateStr}</div>
        </div>
        <div class="header-right">
          <div>Printed: <strong>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
          <div>Volunteers: <strong>${schedules.length}</strong></div>
          <div>Services: <strong>${services.length}</strong></div>
        </div>
      </div>
      <div class="section-label">By Service</div>
      <div class="grid">${byServiceHtml}</div>
      ${byClassHtml ? `<div class="section-label">By Class</div><div class="grid">${byClassHtml}</div>` : ''}
      <script>setTimeout(function(){window.print();window.onafterprint=function(){window.close();}},300);<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Schedule</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          {isAdmin ? 'Assign teachers to classes for each service' : 'Your upcoming teaching assignments'}
        </p>
      </div>

      {isAdmin && (
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)]
              text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <Tip text={!schedules.length ? 'No assignments for this date' : null}>
            <button
              onClick={printSchedule}
              disabled={!schedules.length}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)]
                text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]
                hover:border-[var(--primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Schedule
            </button>
          </Tip>
          <Tip text={!schedules.length ? 'No assignments for this date' : null}>
            <button
              onClick={exportScheduleCSV}
              disabled={!schedules.length}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)]
                text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]
                hover:border-[var(--primary)]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </Tip>
        </div>
      )}

      {isAdmin ? (
        services.length === 0 || classes.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No services or classes configured.</p>
        ) : (
          <>
            {/* Mobile: cards per service */}
            <div className="md:hidden space-y-4">
              {services.map(service => (
                <div key={service.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
                  <div className="px-4 py-3 bg-[var(--muted)]/40 border-b border-[var(--border)]">
                    <p className="font-semibold text-sm text-[var(--foreground)]">{service.name}</p>
                    {service.start_time && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{formatTime(service.start_time)}</p>
                    )}
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {classes.map(cls => {
                      const key = `${cls.id}_${service.id}`
                      const teachers = (scheduleMap[key] ?? []).sort((a, b) => b.is_lead - a.is_lead)
                      return (
                        <button
                          key={cls.id}
                          className="w-full flex items-center justify-between px-4 py-3 text-left
                            hover:bg-[var(--accent)] active:bg-[var(--accent)] transition-colors"
                          onClick={() => setActiveCell({
                            classId: cls.id, serviceId: service.id,
                            className: cls.name,
                            serviceName: `${service.name}${service.start_time ? ` · ${formatTime(service.start_time)}` : ''}`,
                          })}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--foreground)]">{cls.name}</p>
                            {teachers.length === 0 ? (
                              <p className="text-xs text-[var(--muted-foreground)] opacity-50 mt-0.5">No teacher assigned</p>
                            ) : (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {teachers.map(t => (
                                  <span key={t.id} className={`text-xs px-2 py-0.5 rounded-md ${
                                    t.is_lead
                                      ? 'bg-[var(--primary)] text-white font-medium'
                                      : 'bg-[var(--secondary)] text-[var(--secondary-foreground)]'
                                  }`}>
                                    {t.is_lead && '★ '}{t.user.name.split(' ')[0]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0 ml-3"
                            fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: matrix table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full border-collapse bg-[var(--card)]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left p-4 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider min-w-[120px]">
                      Service
                    </th>
                    {classes.map(cls => (
                      <th key={cls.id} className="text-center p-4 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider border-l border-[var(--border)] min-w-[130px]">
                        {cls.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.map((service, i) => (
                    <tr key={service.id} className={i > 0 ? 'border-t border-[var(--border)]' : ''}>
                      <td className="p-4 align-top">
                        <div className="text-sm font-medium text-[var(--foreground)]">{service.name}</div>
                        {service.start_time && (
                          <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{formatTime(service.start_time)}</div>
                        )}
                      </td>
                      {classes.map(cls => {
                        const key = `${cls.id}_${service.id}`
                        const teachers = (scheduleMap[key] ?? []).sort((a, b) => b.is_lead - a.is_lead)
                        return (
                          <td
                            key={cls.id}
                            className="p-2 border-l border-[var(--border)] align-top cursor-pointer hover:bg-[var(--accent)] transition-colors"
                            onClick={() => setActiveCell({
                              classId: cls.id, serviceId: service.id,
                              className: cls.name,
                              serviceName: `${service.name}${service.start_time ? ` · ${formatTime(service.start_time)}` : ''}`,
                            })}
                          >
                            {teachers.length === 0 ? (
                              <div className="text-xs text-[var(--muted-foreground)] text-center py-3 opacity-40">+ Assign</div>
                            ) : (
                              <div className="space-y-1 p-1">
                                {teachers.map(t => (
                                  <div
                                    key={t.id}
                                    className={`text-xs px-2 py-1 rounded-md flex items-center gap-1 ${
                                      t.is_lead
                                        ? 'bg-[var(--primary)] text-white font-medium'
                                        : 'bg-[var(--secondary)] text-[var(--secondary-foreground)]'
                                    }`}
                                  >
                                    {t.is_lead && <span className="flex-shrink-0">★</span>}
                                    <span className="truncate">{t.user.name.split(' ')[0]}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : (
        myGrouped.length === 0 ? (
          <div className="text-center py-16 text-[var(--muted-foreground)]">
            <p className="text-sm">No upcoming assignments.</p>
          </div>
        ) : (
          <div className="space-y-8 max-w-lg">
            {myGrouped.map(([d, entries]) => (
              <div key={d}>
                <h2 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                  {formatDate(d)}
                </h2>
                <div className="space-y-2">
                  {entries.map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                      {s.is_lead ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)] text-white font-medium flex-shrink-0">
                          ★ Lead
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)] flex-shrink-0">
                          Volunteer
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--foreground)] truncate">{s.classGroup.name}</div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {s.service.name}{s.service.start_time ? ` · ${formatTime(s.service.start_time)}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {activeCell && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveCell(null)}
        >
          <div
            className="bg-[var(--card)] rounded-2xl w-full max-w-sm shadow-2xl border border-[var(--border)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[var(--foreground)] text-sm">{activeCell.className}</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{activeCell.serviceName} · {formatDate(date)}</p>
              </div>
              <button
                onClick={() => setActiveCell(null)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors flex-shrink-0 mt-0.5"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-3">
              {cellTeachers.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-2">No teachers assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {cellTeachers.map(t => (
                    <div key={t.id} className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleLead(t)}
                        disabled={mutating}
                        title={t.is_lead ? 'Remove lead' : 'Set as lead'}
                        className={`text-lg leading-none transition-colors flex-shrink-0 ${
                          t.is_lead
                            ? 'text-[var(--primary)]'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--primary)]'
                        }`}
                      >
                        ★
                      </button>
                      <span className="flex-1 text-sm text-[var(--foreground)]">{t.user.name}</span>
                      {t.is_lead && (
                        <span className="text-xs text-[var(--primary)] font-medium">Lead</span>
                      )}
                      <button
                        onClick={() => handleRemove(t.id)}
                        disabled={mutating}
                        className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {availableUsers.length > 0 && (
                <div className="pt-3 border-t border-[var(--border)] space-y-3">
                  <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Add teacher
                  </p>
                  <select
                    value={addUserId}
                    onChange={e => setAddUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]
                      text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="">Select a person...</option>
                    {availableUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addIsLead}
                      onChange={e => setAddIsLead(e.target.checked)}
                      className="rounded"
                    />
                    Set as lead teacher
                  </label>
                  <button
                    onClick={handleAssign}
                    disabled={!addUserId || mutating}
                    className="w-full py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium
                      disabled:opacity-50 hover:opacity-90 transition-opacity"
                  >
                    {assigning ? 'Adding...' : 'Add Teacher'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
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
