import { useMutation, useQuery } from '@apollo/client'
import { SERVICES_QUERY } from '@/graphql/queries'
import { CHECK_IN_MUTATION } from '@/graphql/mutations'
import { useState, useEffect } from 'react'

export default function ServiceStep({ person, household, initialGuardianName = '', initialGuardianPhone = '', onDone, onBack }) {
  const { data, loading } = useQuery(SERVICES_QUERY)
  const [checkIn, { loading: checking }] = useMutation(CHECK_IN_MUTATION)
  const [error, setError]                 = useState('')
  const [autoSelectedId, setAutoSelectedId] = useState(null)
  const [guardianName, setGuardianName]   = useState(initialGuardianName)
  const [guardianPhone, setGuardianPhone] = useState(initialGuardianPhone || household?.phone || '')

  const services = data?.services ?? []

  useEffect(() => {
    if (!services.length) return
    const match = detectCurrentService(services)
    if (match) setAutoSelectedId(match.id)
  }, [services])

  async function handleSelect(serviceId) {
    setError('')
    try {
      const { data } = await checkIn({
        variables: {
          personId:      person.id,
          serviceId,
          guardianName:  guardianName.trim()  || undefined,
          guardianPhone: guardianPhone.trim() || undefined,
        },
      })
      onDone(data.checkIn)
    } catch (e) {
      setError(e.message || 'Check-in failed. Please try again.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[var(--foreground)]">{person.first_name} {person.last_name}</p>
            {person.classGroup && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full
                bg-[var(--primary)]/10 text-[var(--primary)]">
                {person.classGroup.name}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">Guardian info, then select a service</p>
        </div>
      </div>

      {/* Guardian */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
          Today's Guardian
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Name</label>
            <input
              value={guardianName}
              onChange={e => setGuardianName(e.target.value)}
              placeholder="e.g. Grandma Ruth"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Phone</label>
            <input
              type="tel"
              value={guardianPhone}
              onChange={e => setGuardianPhone(e.target.value)}
              placeholder="555-1234"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {autoSelectedId && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--primary)]/8 text-xs text-[var(--primary)]">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Auto-selected based on current time — tap another to override
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {services.map((s) => {
            const isAuto = s.id === autoSelectedId
            return (
              <button
                key={s.id}
                onClick={() => handleSelect(s.id)}
                disabled={checking}
                className={`w-full text-left p-4 rounded-xl border transition-all group
                  disabled:opacity-50 disabled:cursor-not-allowed ${
                  isAuto
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/20'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${isAuto ? 'text-[var(--primary)]' : 'text-[var(--foreground)] group-hover:text-[var(--primary)]'}`}>
                        {s.name}
                      </p>
                      {isAuto && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                          bg-[var(--primary)] text-[var(--primary-foreground)] uppercase tracking-wide">
                          Now
                        </span>
                      )}
                    </div>
                    {s.day_of_week && s.start_time && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        {s.day_of_week} · {formatTime(s.start_time)}
                        {s.end_time && ` – ${formatTime(s.end_time)}`}
                      </p>
                    )}
                  </div>
                  {checking ? <Spinner /> : (
                    <svg className={`w-4 h-4 ${isAuto ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] group-hover:text-[var(--primary)]'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function detectCurrentService(services) {
  const now = new Date()
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return services.find((s) => {
    if (!s.start_time || !s.end_time) return false
    if (s.day_of_week && s.day_of_week !== dayName) return false
    const [sh, sm] = s.start_time.split(':').map(Number)
    const [eh, em] = s.end_time.split(':').map(Number)
    return nowMinutes >= (sh * 60 + sm) && nowMinutes <= (eh * 60 + em)
  }) ?? null
}

function formatTime(time) {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5 text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const inputClass = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`
