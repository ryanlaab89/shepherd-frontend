import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { CHURCH_SETTINGS_QUERY } from '@/graphql/queries'
import { UPDATE_CHURCH_SETTINGS_MUTATION, UPDATE_CHURCH_MUTATION } from '@/graphql/mutations'
import { useAuth } from '@/features/auth/AuthContext'

export default function SettingsPage() {
  const { user, updateUser } = useAuth()

  const { data, loading } = useQuery(CHURCH_SETTINGS_QUERY, { fetchPolicy: 'cache-and-network' })
  const [updateSettings, { loading: saving }] = useMutation(UPDATE_CHURCH_SETTINGS_MUTATION, {
    refetchQueries: [{ query: CHURCH_SETTINGS_QUERY }],
  })
  const [updateChurch, { loading: savingChurch }] = useMutation(UPDATE_CHURCH_MUTATION)

  const requireCheckout = data?.churchSettings?.require_checkout ?? false
  const showCheckout    = data?.churchSettings?.show_checkout    ?? true

  const [churchName,        setChurchName]        = useState(user?.church?.name ?? '')
  const [churchNameSuccess, setChurchNameSuccess] = useState(false)
  const [churchNameError,   setChurchNameError]   = useState('')

  async function toggle(field, value) {
    const input = { [field]: value }
    // Enabling require_checkout must also make the checkout tab visible
    if (field === 'require_checkout' && value === true) {
      input.show_checkout = true
    }
    await updateSettings({ variables: { input } })
  }

  async function handleSaveChurchName(e) {
    e.preventDefault()
    setChurchNameError('')
    setChurchNameSuccess(false)
    try {
      const { data: d } = await updateChurch({ variables: { name: churchName.trim() } })
      updateUser({ church: { ...user.church, name: d.updateChurch.name } })
      setChurchNameSuccess(true)
    } catch (err) {
      setChurchNameError(err.message || 'Could not save church name.')
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Settings</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">{user?.church?.name}</p>
      </div>

      <div className="space-y-4">
        {/* Church details */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
              Church Details
            </h2>
          </div>
          <div className="px-6 py-5">
            {churchNameError && (
              <div className="mb-4 p-3 rounded-lg bg-[var(--destructive)]/10
                text-[var(--destructive)] text-sm">{churchNameError}</div>
            )}
            {churchNameSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 text-emerald-700
                dark:bg-emerald-900/20 dark:text-emerald-400 text-sm">Church name updated.</div>
            )}
            <form onSubmit={handleSaveChurchName} className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Church Name
                </label>
                <input
                  required
                  value={churchName}
                  onChange={e => { setChurchName(e.target.value); setChurchNameSuccess(false) }}
                  className={inputClass}
                  placeholder="e.g. Grace Community Church"
                />
              </div>
              <button
                type="submit"
                disabled={savingChurch || churchName.trim() === (user?.church?.name ?? '')}
                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                  text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors
                  disabled:opacity-50 whitespace-nowrap mb-0.5"
              >
                {savingChurch ? 'Saving…' : 'Save'}
              </button>
            </form>
          </div>
        </div>

        {/* Check-out */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
              Check-Out
            </h2>
          </div>

          <SettingRow
            label="Require check-out"
            description="When enabled, children must be checked out before they can be checked in again. When disabled, re-checking in a child automatically closes their current session."
            checked={requireCheckout}
            loading={loading}
            disabled={saving}
            onToggle={() => toggle('require_checkout', !requireCheckout)}
          />

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
              <span className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm transform
                transition-transform duration-200 mt-1
                ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const inputClass = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`
