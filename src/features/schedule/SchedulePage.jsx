import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { useAuth } from '@/features/auth/AuthContext'
import {
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

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Schedule</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          {isAdmin ? 'Assign teachers to classes for each service' : 'Your upcoming teaching assignments'}
        </p>
      </div>

      {isAdmin && (
        <div className="mb-6">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)]
              text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      )}

      {isAdmin ? (
        services.length === 0 || classes.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No services or classes configured.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
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
