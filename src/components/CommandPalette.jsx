import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { CHILDREN_QUERY } from '@/graphql/queries'
import { useAuth } from '@/features/auth/AuthContext'

const PAGES = [
  { label: 'Dashboard',  to: '/dashboard',  adminOnly: true  },
  { label: 'Check In',   to: '/checkin',    adminOnly: false },
  { label: 'Check Out',  to: '/checkout',   adminOnly: false },
  { label: 'Children',   to: '/children',   adminOnly: false },
  { label: 'Attendance', to: '/attendance', adminOnly: false },
  { label: 'Schedule',   to: '/schedule',   adminOnly: false },
  { label: 'Staff',      to: '/users',      adminOnly: true  },
  { label: 'Services',   to: '/services',   adminOnly: true  },
  { label: 'Classes',    to: '/classes',    adminOnly: true  },
  { label: 'Reports',    to: '/reports',    adminOnly: true  },
  { label: 'Settings',   to: '/settings',   adminOnly: true  },
]

export default function CommandPalette({ open, onClose }) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const { data } = useQuery(CHILDREN_QUERY, { fetchPolicy: 'cache-only' })
  const children = data?.children ?? []

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const pages = PAGES.filter(p => !p.adminOnly || isAdmin)
  const q = query.trim().toLowerCase()

  const matchedPages = q
    ? pages.filter(p => p.label.toLowerCase().includes(q))
    : pages

  const matchedChildren = q.length >= 2
    ? children
        .filter(c =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          (c.household?.last_name ?? '').toLowerCase().includes(q)
        )
        .slice(0, 5)
    : []

  const results = [
    ...matchedPages.map(p => ({ type: 'page', ...p })),
    ...matchedChildren.map(c => ({
      type:  'child',
      id:    c.id,
      label: `${c.first_name} ${c.last_name}`,
      sub:   c.household?.last_name ? `${c.household.last_name} family` : null,
      to:    '/children',
    })),
  ]

  useEffect(() => {
    setActive(0)
  }, [query])

  function select(item) {
    navigate(item.to)
    onClose()
  }

  function handleKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(a => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) select(results[active])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[9990] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 top-[10vh] z-[9991] flex justify-center px-4">
        <div
          className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden
            animate-in slide-in-from-top-4 fade-in duration-150"
          onClick={e => e.stopPropagation()}
        >
          {/* Input row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
            <svg className="w-4 h-4 text-[var(--muted-foreground)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search pages and children…"
              className="flex-1 bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]
                text-sm focus:outline-none"
            />
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-[var(--muted-foreground)]
              border border-[var(--border)] rounded px-1.5 py-0.5 font-mono">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1.5">
            {results.length === 0 ? (
              <p className="px-4 py-4 text-sm text-[var(--muted-foreground)] text-center">
                No results for "{query}"
              </p>
            ) : (
              results.map((item, i) => (
                <button
                  key={`${item.type}-${item.label}-${i}`}
                  onClick={() => select(item)}
                  onMouseEnter={() => setActive(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    active === i ? 'bg-[var(--primary)]/10' : 'hover:bg-[var(--muted)]/40'
                  }`}
                >
                  {item.type === 'page' ? (
                    <div className="w-7 h-7 rounded-lg bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--primary)]/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-[var(--primary)]">{item.label[0]}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate">{item.label}</p>
                    {item.sub && (
                      <p className="text-xs text-[var(--muted-foreground)] truncate">{item.sub}</p>
                    )}
                  </div>
                  {item.type === 'page' && (
                    <span className="text-[10px] text-[var(--muted-foreground)] border border-[var(--border)]
                      rounded px-1.5 py-0.5 flex-shrink-0">
                      Page
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-4
            text-[10px] text-[var(--muted-foreground)]">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>Esc close</span>
            <span className="ml-auto">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
