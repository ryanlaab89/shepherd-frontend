import { useQuery, useMutation } from '@apollo/client'
import { CHURCH_SETTINGS_QUERY } from '@/graphql/queries'
import { UPDATE_CHURCH_SETTINGS_MUTATION } from '@/graphql/mutations'
import { useAuth } from '@/features/auth/AuthContext'

export default function SettingsPage() {
  const { user } = useAuth()

  const { data, loading } = useQuery(CHURCH_SETTINGS_QUERY, { fetchPolicy: 'cache-and-network' })
  const [updateSettings, { loading: saving }] = useMutation(UPDATE_CHURCH_SETTINGS_MUTATION, {
    refetchQueries: [{ query: CHURCH_SETTINGS_QUERY }],
  })

  const requireCheckout = data?.churchSettings?.require_checkout ?? false
  const showCheckout    = data?.churchSettings?.show_checkout    ?? true

  async function toggle(field, value) {
    await updateSettings({ variables: { input: { [field]: value } } })
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">{user?.church?.name}</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
              Check-Out
            </h2>
          </div>

          {/* Require checkout toggle */}
          <SettingRow
            label="Require check-out"
            description="When enabled, children must be checked out before they can be checked in again. When disabled, re-checking in a child automatically closes their current session."
            checked={requireCheckout}
            loading={loading}
            disabled={saving}
            onToggle={() => toggle('require_checkout', !requireCheckout)}
          />

          {/* Show checkout toggle — only relevant when checkout is not required */}
          <div className={requireCheckout ? 'opacity-40 pointer-events-none' : ''}>
            <SettingRow
              label="Show check-out tab"
              description={
                requireCheckout
                  ? 'Always visible when check-out is required.'
                  : 'Show or hide the Check Out page in the navigation. Useful when your church skips check-out entirely.'
              }
              checked={requireCheckout ? true : showCheckout}
              loading={loading}
              disabled={saving || requireCheckout}
              onToggle={() => toggle('show_checkout', !showCheckout)}
              divider
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, description, checked, loading, disabled, onToggle, divider = false }) {
  return (
    <div className={`px-6 py-5 ${divider ? 'border-t border-[var(--border)]' : ''}`}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1 leading-relaxed">{description}</p>
        </div>

        <div className="flex-shrink-0 pt-0.5">
          {loading ? (
            <div className="w-11 h-6 rounded-full bg-[var(--muted)] animate-pulse" />
          ) : (
            <button
              onClick={onToggle}
              disabled={disabled}
              role="switch"
              aria-checked={checked}
              className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2
                disabled:cursor-not-allowed
                ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--muted-foreground)]/30'}`}
            >
              <span
                className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-1
                  ${checked ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
