import { useState } from 'react'
import { useQuery } from '@apollo/client'
import { CHURCH_SETTINGS_QUERY } from '@/graphql/queries'
import SearchStep from './SearchStep'
import ServiceStep from './ServiceStep'
import ConfirmationStep from './ConfirmationStep'

export default function CheckInPage() {
  const [step, setStep]         = useState('search')
  // search | service | done
  const [person,        setPerson]        = useState(null)
  const [household,     setHousehold]     = useState(null)
  const [checkin,       setCheckin]       = useState(null)
  const [initGuardian,  setInitGuardian]  = useState({ name: '', phone: '' })

  const { data: settingsData } = useQuery(CHURCH_SETTINGS_QUERY, { fetchPolicy: 'cache-first' })
  const showCheckout = settingsData?.churchSettings?.show_checkout ?? true

  function reset() {
    setStep('search')
    setPerson(null)
    setHousehold(null)
    setCheckin(null)
    setInitGuardian({ name: '', phone: '' })
  }

  // guardianName / guardianPhone supplied by SearchStep for new registrations; omitted for existing children.
  function onSelectPerson(p, guardianName, guardianPhone) {
    setPerson(p)
    setHousehold(p.household ?? null)
    setInitGuardian({
      name:  guardianName  ?? '',
      phone: guardianPhone ?? p.household?.phone ?? '',
    })
    setStep('service')
  }

  const stepIndex = { search: 0, service: 1, done: 1 }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Check In</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Search for a child or register a new family
        </p>
      </div>

      {step !== 'done' && (
        <StepBar
          steps={['Search', 'Confirm']}
          current={stepIndex[step]}
        />
      )}

      <div className="mt-8">
        {step === 'search' && (
          <SearchStep onSelectPerson={onSelectPerson} />
        )}

        {step === 'service' && (
          <ServiceStep
            person={person}
            household={household}
            initialGuardianName={initGuardian.name}
            initialGuardianPhone={initGuardian.phone}
            onDone={(ci) => { setCheckin(ci); setStep('done') }}
            onBack={() => setStep('search')}
          />
        )}

        {step === 'done' && (
          <ConfirmationStep
            checkin={checkin}
            showCheckout={showCheckout}
            onAnother={reset}
          />
        )}
      </div>
    </div>
  )
}

function StepBar({ steps, current }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < current
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : i === current
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)] ring-4 ring-[var(--primary)]/20'
                  : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
            }`}>
              {i < current ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium ${
              i <= current ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
            }`}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-px mx-2 mb-4 transition-colors ${
              i < current ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}
