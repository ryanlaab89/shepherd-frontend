export default function ChildStep({ household, onSelect, onBack, onAddChild }) {
  const people = household?.people ?? []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <p className="font-semibold text-[var(--foreground)]">{household.last_name} Family</p>
          <p className="text-xs text-[var(--muted-foreground)]">Select a child to check in</p>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="text-center py-10 text-[var(--muted-foreground)]">
          <p className="text-sm">No children registered for this household</p>
        </div>
      ) : (
        <div className="space-y-2">
          {people.map((p) => {
            const alreadyIn = !!p.activeCheckin

            return (
              <button
                key={p.id}
                onClick={() => !alreadyIn && onSelect(p)}
                disabled={alreadyIn}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  alreadyIn
                    ? 'border-[var(--border)] bg-[var(--muted)] opacity-60 cursor-not-allowed'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 group'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[var(--primary)]/15 flex items-center justify-center text-sm font-bold text-[var(--primary)]">
                      {p.first_name[0]}
                    </div>
                    <div>
                      <p className={`font-medium ${alreadyIn ? 'text-[var(--muted-foreground)]' : 'text-[var(--foreground)] group-hover:text-[var(--primary)]'}`}>
                        {p.first_name} {p.last_name}
                      </p>
                      {p.date_of_birth && (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {age(p.date_of_birth)} years old
                        </p>
                      )}
                      {p.medical_notes && (
                        <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Medical note on file
                        </p>
                      )}
                    </div>
                  </div>
                  {alreadyIn ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-medium">
                      Checked In · {p.activeCheckin.pickup_code}
                    </span>
                  ) : (
                    <svg className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)]"
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

      {/* Add another child to this existing household */}
      <button
        onClick={onAddChild}
        className="w-full py-2.5 rounded-lg border border-dashed border-[var(--border)]
          text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)]
          hover:text-[var(--primary)] transition-colors flex items-center justify-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add a new child to the {household.last_name} family
      </button>
    </div>
  )
}

function age(dob) {
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}
