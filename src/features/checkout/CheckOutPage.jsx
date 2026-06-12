import { useState, useEffect, useRef } from 'react'
import { useLazyQuery, useQuery, useMutation } from '@apollo/client'
import { CHECKIN_BY_CODE_QUERY, ACTIVE_CHECKINS_QUERY } from '@/graphql/queries'
import { CHECK_OUT_MUTATION } from '@/graphql/mutations'

export default function CheckOutPage() {
  const [confirmed, setConfirmed] = useState(null)

  if (confirmed) {
    return (
      <div className="p-4 sm:p-8 max-w-lg mx-auto">
        <div className="text-center space-y-5">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Checked Out!</h2>
            <p className="text-[var(--muted-foreground)] text-sm mt-1">
              {confirmed.person.first_name} {confirmed.person.last_name} has been safely released.
            </p>
          </div>
          <button
            onClick={() => setConfirmed(null)}
            className="px-6 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
              text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors"
          >
            Check Out Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Check Out</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Scan the label barcode or search by child name
        </p>
      </div>

      <ScanSearch onDone={setConfirmed} />
    </div>
  )
}

function ScanSearch({ onDone }) {
  const inputRef = useRef(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [showNameSearch, setShowNameSearch] = useState(false)

  const [searchByCode, { data, loading: searching }] = useLazyQuery(CHECKIN_BY_CODE_QUERY, {
    fetchPolicy: 'no-cache',
  })
  const [checkOut, { loading: checkingOut }] = useMutation(CHECK_OUT_MUTATION)
  const foundCheckin = data?.checkinByCode

  // Keep input focused so scanner can fire at any time
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSearch(value) {
    const trimmed = (value ?? code).trim().toUpperCase()
    if (!trimmed) return
    setError('')
    const { data } = await searchByCode({ variables: { code: trimmed } })
    if (!data?.checkinByCode) {
      setError(`No active check-in found for code "${trimmed}".`)
    }
  }

  function handleChange(e) {
    const val = e.target.value.toUpperCase()
    setCode(val)
    setError('')
    // Clear previous result when typing a new code
    if (data?.checkinByCode) {
      // searching again resets automatically via fetchPolicy: 'no-cache'
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  async function handleCheckOut() {
    setError('')
    try {
      const { data: res } = await checkOut({ variables: { checkinId: foundCheckin.id } })
      onDone(res.checkOut)
    } catch (e) {
      setError(e.message || 'Check-out failed.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Scanner / code input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 4H8a2 2 0 00-2 2v2M12 4h4a2 2 0 012 2v2M12 4v2m0 14H8a2 2 0 01-2-2v-2m8 4h4a2 2 0 002-2v-2M12 20v-2M4 12H2m20 0h-2M4 12v0M20 12v0" />
          </svg>
        </div>
        <input
          ref={inputRef}
          value={code}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Scan barcode or type code…"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="w-full pl-10 pr-24 py-3 rounded-xl border-2 border-[var(--input)] bg-[var(--background)]
            text-[var(--foreground)] text-base font-mono tracking-wider
            placeholder:text-[var(--muted-foreground)]/50 placeholder:font-sans placeholder:tracking-normal
            focus:outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/15
            transition-all"
        />
        <button
          onClick={() => handleSearch()}
          disabled={!code.trim() || searching}
          className="absolute inset-y-1.5 right-1.5 px-4 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-sm font-semibold
            hover:bg-[var(--primary)]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {searching ? '…' : 'Find'}
        </button>
      </div>

      <p className="text-xs text-center text-[var(--muted-foreground)]">
        Point the scanner at the label barcode — it will auto-submit
      </p>

      {error && (
        <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">
          {error}
        </div>
      )}

      {foundCheckin && !error && (
        <CheckinConfirmCard
          checkin={foundCheckin}
          onCheckOut={handleCheckOut}
          loading={checkingOut}
          onCancel={() => { setCode(''); setError('') }}
        />
      )}

      {/* Name search toggle */}
      <div className="pt-2 border-t border-[var(--border)]">
        <button
          onClick={() => setShowNameSearch(v => !v)}
          className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]
            hover:text-[var(--foreground)] transition-colors mx-auto"
        >
          <svg className={`w-4 h-4 transition-transform ${showNameSearch ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showNameSearch ? 'Hide name search' : "Can't scan? Search by name"}
        </button>

        {showNameSearch && (
          <div className="mt-4">
            <NameSearch onDone={onDone} />
          </div>
        )}
      </div>
    </div>
  )
}

function NameSearch({ onDone }) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const { data, loading } = useQuery(ACTIVE_CHECKINS_QUERY, { fetchPolicy: 'network-only', pollInterval: 10000 })
  const [checkOut, { loading: checkingOut }] = useMutation(CHECK_OUT_MUTATION)
  const [pendingCheckin, setPendingCheckin] = useState(null)

  const all = data?.activeCheckins ?? []
  const filtered = query.trim().length < 2 ? all : all.filter(c => {
    const q = query.toLowerCase()
    return (
      c.person.first_name.toLowerCase().includes(q) ||
      c.person.last_name.toLowerCase().includes(q) ||
      `${c.person.first_name} ${c.person.last_name}`.toLowerCase().includes(q)
    )
  })

  async function handleCheckOut(checkin) {
    setError('')
    try {
      const { data } = await checkOut({ variables: { checkinId: checkin.id } })
      onDone(data.checkOut)
    } catch (e) {
      setError(e.message || 'Check-out failed.')
    }
  }

  if (pendingCheckin) {
    return (
      <div className="space-y-4">
        <button onClick={() => setPendingCheckin(null)}
          className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]
            hover:text-[var(--foreground)] transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to list
        </button>
        {error && (
          <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">{error}</div>
        )}
        <CheckinConfirmCard
          checkin={pendingCheckin}
          onCheckOut={() => handleCheckOut(pendingCheckin)}
          loading={checkingOut}
          onCancel={() => setPendingCheckin(null)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Type child's name…"
        className="w-full px-3 py-2.5 rounded-lg border border-[var(--input)] bg-[var(--background)]
          text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
          focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors"
      />

      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-[var(--muted-foreground)] py-4">
          {query.trim().length >= 2
            ? `No active check-ins matching "${query}"`
            : 'No children currently checked in'}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--muted-foreground)]">
            {filtered.length} {filtered.length === 1 ? 'child' : 'children'} currently checked in
          </p>
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setPendingCheckin(c)}
              className="w-full text-left p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]
                hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                    text-sm font-bold text-[var(--primary)]">
                    {c.person.first_name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--foreground)] group-hover:text-[var(--primary)]">
                      {c.person.first_name} {c.person.last_name}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {c.service.name} · in since {new Date(c.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CheckinConfirmCard({ checkin, onCheckOut, loading, onCancel }) {
  return (
    <div className="p-5 rounded-xl border-2 border-[var(--primary)] bg-[var(--primary)]/5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
          text-base font-bold text-[var(--primary)] flex-shrink-0">
          {checkin.person.first_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--foreground)]">
            {checkin.person.first_name} {checkin.person.last_name}
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">{checkin.service.name}</p>
          {checkin.person.medical_notes && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Medical note on file
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5">Code</p>
          <p className="font-mono font-extrabold text-xl text-[var(--primary)] tracking-widest">
            {checkin.pickup_code}
          </p>
        </div>
      </div>

      <p className="text-xs text-[var(--muted-foreground)]">
        Checked in at {new Date(checkin.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm
            text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onCheckOut}
          disabled={loading}
          className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
            text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60"
        >
          {loading ? 'Processing…' : 'Confirm Check Out'}
        </button>
      </div>
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
