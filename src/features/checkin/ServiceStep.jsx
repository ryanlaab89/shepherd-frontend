import { useMutation, useQuery } from '@apollo/client'
import { SERVICES_QUERY } from '@/graphql/queries'
import { CHECK_IN_MUTATION } from '@/graphql/mutations'
import { useState, useEffect } from 'react'
import { detectActiveService, fmtServiceTime } from '@/lib/serviceUtils'

export default function ServiceStep({ person, household, initialGuardianName = '', initialGuardianPhone = '', onDone, onBack }) {
  const { data, loading } = useQuery(SERVICES_QUERY)
  const [checkIn, { loading: checking }] = useMutation(CHECK_IN_MUTATION)

  const [error,         setError]         = useState('')
  const [autoResult,    setAutoResult]    = useState(null)   // { service, reason } | null
  const [fallbackId,    setFallbackId]    = useState('')     // used only in no-service fallback
  const [guardianName,  setGuardianName]  = useState(initialGuardianName)
  const [guardianPhone, setGuardianPhone] = useState(initialGuardianPhone || household?.phone || '')

  const services = data?.services ?? []

  useEffect(() => {
    if (!services.length) return
    setAutoResult(detectActiveService(services))
  }, [services])

  async function handleCheckIn(serviceId) {
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

  const reasonLabel = {
    active:   { text: 'In progress',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    upcoming: { text: 'Starting soon', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    recent:   { text: "Today's service", cls: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]">
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
          <p className="text-xs text-[var(--muted-foreground)]">Confirm guardian info and check in</p>
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

      {error && (
        <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : autoResult ? (
        /* ── Auto-detected service ── */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-4 py-3 rounded-xl
            border border-[var(--primary)]/30 bg-[var(--primary)]/5">
            <div>
              <p className="font-semibold text-[var(--foreground)]">{autoResult.service.name}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {fmtServiceTime(autoResult.service)}
              </p>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${reasonLabel[autoResult.reason].cls}`}>
              {reasonLabel[autoResult.reason].text}
            </span>
          </div>

          <button
            onClick={() => handleCheckIn(autoResult.service.id)}
            disabled={checking}
            className="w-full py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]
              font-semibold text-sm hover:bg-[var(--primary)]/90 disabled:opacity-50
              active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {checking ? <><Spinner /> Checking in…</> : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Check In to {autoResult.service.name}
              </>
            )}
          </button>
        </div>
      ) : (
        /* ── No service detected — fallback picker ── */
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted-foreground)]">
            No service is scheduled right now — select one manually:
          </p>
          {services.map(s => (
            <button
              key={s.id}
              onClick={() => handleCheckIn(s.id)}
              disabled={checking}
              className="w-full text-left p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]
                hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all group
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">
                    {s.name}
                  </p>
                  {s.start_time && (
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {fmtServiceTime(s)}
                    </p>
                  )}
                </div>
                {checking && fallbackId === s.id
                  ? <Spinner />
                  : <svg className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                }
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

const inputClass = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`
