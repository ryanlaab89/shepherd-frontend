import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-5xl font-black text-[var(--primary)] mb-3">404</p>
        <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">Page not found</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-8">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium
              text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)]/40
              transition-colors">
            ← Go back
          </button>
          <Link
            to={isAuthenticated ? '/dashboard' : '/login'}
            className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
              text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors">
            {isAuthenticated ? 'Go to Dashboard' : 'Go to Login'}
          </Link>
        </div>
      </div>
    </div>
  )
}
