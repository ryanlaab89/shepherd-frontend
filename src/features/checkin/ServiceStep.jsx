import { useMutation, useQuery } from '@apollo/client'
import { SERVICES_QUERY, CLASSES_QUERY } from '@/graphql/queries'
import { CHECK_IN_MUTATION } from '@/graphql/mutations'
import { useState, useEffect } from 'react'
import { detectActiveService, fmtServiceTime } from '@/lib/serviceUtils'

// Full years from DOB string (null if no DOB)
function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  const now   = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

// Returns null if eligible, otherwise a human-readable reason string
function ageError(cls, age) {
  if (age === null) return null // no DOB — can't validate, allow through
  if (cls.min_age !== null && age < cls.min_age) {
    return `Must be at least ${cls.min_age} yrs (child is ${age})`
  }
  if (cls.max_age !== null && age > cls.max_age) {
    return `Must be ${cls.max_age} yrs or younger (child is ${age})`
  }
  return null
}

function ageRangeLabel(cls) {
  if (cls.min_age !== null && cls.max_age !== null) return `${cls.min_age}–${cls.max_age} yrs`
  if (cls.min_age !== null) return `${cls.min_age}+ yrs`
  if (cls.max_age !== null) return `Up to ${cls.max_age} yrs`
  return null
}

export default function ServiceStep({ person, household, initialGuardianName = '', initialGuardianPhone = '', onDone, onBack }) {
  const { data: svcData, loading: svcLoading } = useQuery(SERVICES_QUERY)
  const { data: clsData }                      = useQuery(CLASSES_QUERY)
  const [checkIn, { loading: checking }]       = useMutation(CHECK_IN_MUTATION)

  const [error,         setError]         = useState('')
  const [autoResult,    setAutoResult]    = useState(null)
  const [selectedClass, setSelectedClass] = useState(person.classGroup?.id ?? '')
  const [classError,    setClassError]    = useState('')
  const [guardianName,  setGuardianName]  = useState(initialGuardianName)
  const [guardianPhone, setGuardianPhone] = useState(initialGuardianPhone || household?.phone || '')

  const services = svcData?.services ?? []
  const classes  = clsData?.classes  ?? []
  const childAge = calcAge(person.date_of_birth)

  useEffect(() => {
    if (!services.length) return
    setAutoResult(detectActiveService(services))
  }, [services])

  function handleClassSelect(cls) {
    const err = ageError(cls, childAge)
    if (err) {
      setClassError(`Cannot assign to ${cls.name}: ${err}.`)
      return
    }
    setClassError('')
    setSelectedClass(cls.id)
  }

  async function handleCheckIn(serviceId) {
    // Re-validate the selected class before submitting
    if (selectedClass) {
      const cls = classes.find(c => c.id === selectedClass)
      if (cls) {
        const err = ageError(cls, childAge)
        if (err) {
          setError(`Age restriction: ${err} for ${cls.name}.`)
          return
        }
      }
    }

    setError('')
    try {
      const { data } = await checkIn({
        variables: {
          personId:      person.id,
          serviceId,
          classId:       selectedClass || undefined,
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
    active:   { text: 'In progress',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    upcoming: { text: 'Starting soon',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
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
            {childAge !== null && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full
                bg-[var(--muted)] text-[var(--muted-foreground)]">
                {childAge} yrs
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">Confirm class, guardian info, and check in</p>
        </div>
      </div>

      {/* Class selection */}
      {classes.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
            Class
          </p>

          {classError && (
            <div className="mb-3 flex items-start gap-2 p-2.5 rounded-lg
              bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-red-700 dark:text-red-400">{classError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* No class option */}
            <button
              type="button"
              onClick={() => { setSelectedClass(''); setClassError('') }}
              className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                selectedClass === ''
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/50'
              }`}
            >
              <span className="font-medium">No class</span>
            </button>

            {classes.map(cls => {
              const err    = ageError(cls, childAge)
              const isSelected = selectedClass === cls.id
              const range  = ageRangeLabel(cls)

              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => handleClassSelect(cls)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                    isSelected
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                      : err
                        ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10 cursor-not-allowed'
                        : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`font-medium ${
                      isSelected ? 'text-[var(--primary)]' : err ? 'text-red-500 dark:text-red-400' : 'text-[var(--foreground)]'
                    }`}>
                      {cls.name}
                    </span>
                    {err ? (
                      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : isSelected ? (
                      <svg className="w-4 h-4 text-[var(--primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </div>
                  {range && (
                    <p className={`text-[10px] mt-0.5 ${
                      err ? 'text-red-400' : 'text-[var(--muted-foreground)]'
                    }`}>
                      {range}{err ? ' · ' + err : ''}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

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
              autoFocus={classes.length === 0}
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
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {svcLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : autoResult ? (
        /* Auto-detected service */
        <div className="space-y-3">
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
        /* No service detected — fallback picker */
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
                {checking
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
