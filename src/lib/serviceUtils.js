function timeToMins(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Picks the most relevant service for right now using a three-tier priority:
 *   1. Currently active (within start–end window, or within 2 h of start if no end time)
 *   2. Starting within the next 30 minutes
 *   3. Most recently started service today (fallback — already in progress or just ended)
 *
 * Returns { service, reason } or null when nothing qualifies for today.
 */
export function detectActiveService(services) {
  if (!services?.length) return null

  const now     = new Date()
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]
  const nowMins = now.getHours() * 60 + now.getMinutes()

  const todayServices = services.filter(
    s => !s.day_of_week || s.day_of_week.toLowerCase() === dayName.toLowerCase()
  )
  if (!todayServices.length) return null

  // 1. Currently active
  const active = todayServices.find(s => {
    const startMins = timeToMins(s.start_time)
    if (startMins === null) return false
    const endMins = s.end_time ? timeToMins(s.end_time) : startMins + 120
    return nowMins >= startMins && nowMins <= endMins
  })
  if (active) return { service: active, reason: 'active' }

  // 2. Starting within 30 minutes
  const upcoming = todayServices
    .filter(s => {
      const startMins = timeToMins(s.start_time)
      return startMins !== null && startMins > nowMins && startMins - nowMins <= 30
    })
    .sort((a, b) => timeToMins(a.start_time) - timeToMins(b.start_time))[0]
  if (upcoming) return { service: upcoming, reason: 'upcoming' }

  // 3. Most recently started today
  const past = todayServices
    .filter(s => {
      const startMins = timeToMins(s.start_time)
      return startMins !== null && startMins <= nowMins
    })
    .sort((a, b) => timeToMins(b.start_time) - timeToMins(a.start_time))[0]
  if (past) return { service: past, reason: 'recent' }

  return null
}

export function fmtServiceTime(service) {
  if (!service?.start_time) return service?.day_of_week ?? ''
  const [h, m] = service.start_time.split(':').map(Number)
  const time   = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  return service.day_of_week ? `${service.day_of_week} · ${time}` : time
}
