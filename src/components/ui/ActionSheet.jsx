import { useEffect } from 'react'

/**
 * ActionSheet — slides up from the bottom on mobile.
 * Render one per page; open/close it by toggling the `open` prop.
 *
 * Props
 *   open     {boolean}        — controls visibility
 *   onClose  {() => void}     — called on backdrop tap or Escape
 *   title    {string?}        — optional row name shown at the top
 *   children {ActionSheetItem...}
 */
export function ActionSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-[var(--card)]
          border-t border-[var(--border)] shadow-xl
          animate-in slide-in-from-bottom duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 pt-1 pb-3">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">{title}</p>
            <div className="mt-2 h-px bg-[var(--border)]" />
          </div>
        )}

        {/* Items */}
        <div className="px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
          {children}
        </div>
      </div>
    </>
  )
}

/**
 * ActionSheetItem — a single tappable row inside an ActionSheet.
 *
 * Props
 *   label       {string}
 *   icon        {ReactNode?}   — 24×24 SVG element
 *   onClick     {() => void}
 *   destructive {boolean?}     — renders in red
 */
export function ActionSheetItem({ icon, label, onClick, destructive = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
        text-left transition-colors
        ${destructive
          ? 'text-[var(--destructive)] hover:bg-[var(--destructive)]/10 active:bg-[var(--destructive)]/15'
          : 'text-[var(--foreground)] hover:bg-[var(--muted)] active:bg-[var(--muted)]'}`}
    >
      {icon && (
        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
          {icon}
        </span>
      )}
      {label}
    </button>
  )
}
