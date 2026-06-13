import { useState } from 'react'
import { useQuery, useMutation } from '@apollo/client'
import { SERVICES_QUERY } from '@/graphql/queries'
import {
  CREATE_SERVICE_MUTATION,
  UPDATE_SERVICE_MUTATION,
  DELETE_SERVICE_MUTATION,
} from '@/graphql/mutations'
import { useToast } from '@/contexts/ToastContext'
import { ActionSheet, ActionSheetItem } from '@/components/ui/ActionSheet'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const BLANK = { name: '', day_of_week: 'Sunday', start_time: '', end_time: '' }

export default function ServicesPage() {
  const toast = useToast()
  const { data, loading, refetch } = useQuery(SERVICES_QUERY)
  const [createService] = useMutation(CREATE_SERVICE_MUTATION, { onCompleted: () => refetch() })
  const [updateService] = useMutation(UPDATE_SERVICE_MUTATION, { onCompleted: () => refetch() })
  const [deleteService] = useMutation(DELETE_SERVICE_MUTATION, { onCompleted: () => refetch() })

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // mobile action sheet
  const [sheetFor, setSheetFor] = useState(null)

  // delete confirm
  const [confirmState, setConfirmState] = useState(null) // { service }
  const [confirmLoading, setConfirmLoading] = useState(false)

  const services = data?.services ?? []

  function set(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function startEdit(svc) {
    setEditingId(svc.id)
    setForm({
      name:        svc.name,
      day_of_week: svc.day_of_week || 'Sunday',
      start_time:  svc.start_time ? svc.start_time.slice(0, 5) : '',
      end_time:    svc.end_time   ? svc.end_time.slice(0, 5)   : '',
    })
    setError('')
    setShowForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setError('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const input = {
      name:        form.name,
      day_of_week: form.day_of_week || null,
      start_time:  form.start_time  ? `${form.start_time}:00` : null,
      end_time:    form.end_time    ? `${form.end_time}:00`   : null,
    }
    try {
      if (editingId) {
        await updateService({ variables: { id: editingId, input } })
        setEditingId(null)
      } else {
        await createService({ variables: { input } })
        setForm(BLANK)
        setShowForm(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(svc) {
    setSheetFor(null)
    setConfirmState({ service: svc })
  }

  async function confirmAction() {
    setConfirmLoading(true)
    try {
      await deleteService({ variables: { id: confirmState.service.id } })
      toast?.success(`"${confirmState.service.name}" deleted`)
      setConfirmState(null)
    } catch (err) {
      toast?.error(err.message)
      setConfirmState(null)
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Services</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Set start and end times so check-in auto-selects the right service
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(BLANK); setError('') }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-sm font-semibold flex-shrink-0 whitespace-nowrap
            hover:bg-[var(--primary)]/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Add Service
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-6 p-5 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5">
          <p className="font-semibold text-[var(--foreground)] mb-4">New Service</p>
          <ServiceForm
            form={form} set={set} error={error} saving={saving}
            onSubmit={handleSave}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Services list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {services.map((svc) => (
            <div key={svc.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              {editingId === svc.id ? (
                <div className="p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)] mb-3">Edit Service</p>
                  <ServiceForm
                    form={form} set={set} error={error} saving={saving}
                    onSubmit={handleSave}
                    onCancel={cancelEdit}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer md:cursor-default"
                  onClick={() => { if (window.innerWidth < 768) setSheetFor(svc) }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--foreground)]">{svc.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {svc.day_of_week && (
                        <span className="text-xs text-[var(--muted-foreground)]">{svc.day_of_week}</span>
                      )}
                      {svc.start_time && (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {formatTime(svc.start_time)}
                          {svc.end_time && ` – ${formatTime(svc.end_time)}`}
                        </span>
                      )}
                      {!svc.start_time && (
                        <span className="text-xs text-amber-500 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          No time set — won't auto-select
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Desktop-only action buttons */}
                  <div className="hidden md:flex items-center gap-1">
                    <button
                      onClick={() => startEdit(svc)}
                      className="p-1.5 rounded-lg text-[var(--muted-foreground)]
                        hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(svc)}
                      className="p-1.5 rounded-lg text-[var(--muted-foreground)]
                        hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 rounded-xl bg-[var(--muted)]">
        <p className="text-xs text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">Auto-select:</span>
          {' '}When a volunteer opens Check In, the service whose day and time window matches right now
          will be pre-selected. Set both start and end times to enable this.
        </p>
      </div>

      {/* Mobile action sheet */}
      <ActionSheet
        open={!!sheetFor}
        onClose={() => setSheetFor(null)}
        title={sheetFor?.name}
      >
        <ActionSheetItem
          label="Edit"
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
          onClick={() => { startEdit(sheetFor); setSheetFor(null) }}
        />
        <ActionSheetItem
          label="Delete"
          destructive
          icon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          }
          onClick={() => handleDelete(sheetFor)}
        />
      </ActionSheet>

      {/* Delete confirm modal */}
      {confirmState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmState(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6
              max-w-sm w-full mx-4 shadow-xl animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">
              Delete &quot;{confirmState.service.name}&quot;?
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5">
              This will permanently remove this service. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmAction}
                disabled={confirmLoading}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white
                  text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {confirmLoading ? '…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmState(null)}
                className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm
                  text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ServiceForm({ form, set, error, saving, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && (
        <div className="p-3 rounded-lg bg-[var(--destructive)]/10 text-[var(--destructive)] text-sm">{error}</div>
      )}
      <Field label="Service Name">
        <input required value={form.name} onChange={set('name')}
          className={input} placeholder="Sunday 9:30 AM" autoFocus />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Day">
          <select value={form.day_of_week} onChange={set('day_of_week')} className={input}>
            {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Start Time">
          <input type="time" value={form.start_time} onChange={set('start_time')} className={input} />
        </Field>
        <Field label="End Time">
          <input type="time" value={form.end_time} onChange={set('end_time')} className={input} />
        </Field>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm
            text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
            text-sm font-semibold hover:bg-[var(--primary)]/90 transition-colors disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">{label}</label>
      {children}
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

function formatTime(time) {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

const input = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`
