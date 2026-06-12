const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function timeToMins(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Returns the Date of the current or next occurrence of dayOfWeek.
 * If today matches, returns today. Otherwise returns the next future occurrence.
 */
function nextServiceDate(dayOfWeek) {
  if (!dayOfWeek) return new Date()
  const target = DAY_NAMES.findIndex(d => d.toLowerCase() === dayOfWeek.toLowerCase())
  if (target === -1) return new Date()

  const now  = new Date()
  let diff = target - now.getDay()
  if (diff < 0) diff += 7   // already past → jump to next week
  const date = new Date(now)
  date.setDate(now.getDate() + diff)
  return date
}

function fmtDate(date) {
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
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
  const dayName = DAY_NAMES[now.getDay()]
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

/**
 * Formats a service's time string, now including the actual calendar date
 * (today if the service is today, otherwise the next occurrence of that day).
 * Example: "Sunday, 06/15/2026 · 10:00 AM"
 */
export function fmtServiceTime(service) {
  const datePart = service?.day_of_week
    ? `${service.day_of_week}, ${fmtDate(nextServiceDate(service.day_of_week))}`
    : null

  if (!service?.start_time) return datePart ?? ''

  const [h, m] = service.start_time.split(':').map(Number)
  const time = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`

  return datePart ? `${datePart} · ${time}` : time
}
