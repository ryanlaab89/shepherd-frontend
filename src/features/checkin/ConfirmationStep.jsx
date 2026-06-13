import QRCode from 'qrcode'

export default function ConfirmationStep({ checkin, showCheckout = true, onAnother, household, onSiblingCheckIn }) {
  async function printLabel() {
    const guardianLine = checkin.guardian_name
      ? `<div class="guardian">Guardian: ${checkin.guardian_name}</div>`
      : ''

    const qrImgTag = showCheckout
      ? `<img src="${await QRCode.toDataURL(checkin.pickup_code, { width: 80, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })}" width="80" height="80" />`
      : ''

    const win = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Check-In Label</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Plus Jakarta Sans', sans-serif; }
          .label {
            width: 4in; height: 2.5in;
            border: 2px solid #1A3A8C;
            border-radius: 12px;
            padding: 14px 18px;
            display: flex; flex-direction: column; justify-content: space-between;
            overflow: hidden;
          }
          .header { display: flex; align-items: center; gap: 8px; }
          .dot { width: 9px; height: 9px; border-radius: 50%; background: #1A3A8C; flex-shrink: 0; }
          .app-name { font-size: 10px; font-weight: 600; color: #1A3A8C; letter-spacing: 0.08em; text-transform: uppercase; }
          .child-name { font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.1; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .service { font-size: 11px; color: #64748b; margin-top: 2px; }
          .guardian { font-size: 10px; color: #475569; margin-top: 2px; font-weight: 600; }
          .qr-section { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; flex-shrink: 0; }
          .qr-section img { display: block; }
          .code { font-size: 12px; font-weight: 700; color: #1A3A8C; letter-spacing: 0.22em; font-family: monospace; }
          .footer { display: flex; align-items: flex-end; justify-content: space-between; flex-shrink: 0; }
          .time { font-size: 9px; color: #94a3b8; text-align: right; line-height: 1.5; }
          @media print {
            body { margin: 0; }
            .label { border: 2px solid #1A3A8C !important; }
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">
            <div class="dot"></div>
            <span class="app-name">Shepherd Check-In</span>
          </div>
          <div style="min-width:0">
            <div class="child-name">${checkin.person.first_name} ${checkin.person.last_name}</div>
            <div class="service">${checkin.service.name}</div>
            ${guardianLine}
          </div>
          <div class="footer">
            ${showCheckout ? `
            <div class="qr-section">
              ${qrImgTag}
              <div class="code">${checkin.pickup_code}</div>
            </div>` : '<div></div>'}
            <div class="time">
              ${new Date(checkin.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br/>
              ${new Date(checkin.checked_in_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <script>
          window.onload = () => { window.print(); window.onafterprint = () => window.close(); };
        <\/script>
      </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="text-center space-y-6">
      {/* Success icon */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-[var(--primary)]/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-[var(--foreground)]">Checked In!</h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          {checkin.person.first_name} {checkin.person.last_name} · {checkin.service.name}
        </p>
      </div>

      {/* Pickup code display — only when checkout is in use */}
      {showCheckout && (
        <div className="inline-block">
          <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Pickup Code</p>
          <div className="flex gap-2 justify-center">
            {checkin.pickup_code.split('').map((char, i) => (
              <div
                key={i}
                className="w-14 h-16 rounded-xl bg-[var(--primary)] flex items-center justify-center
                  text-2xl font-extrabold text-[var(--primary-foreground)] shadow-sm"
              >
                {char}
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-2">Give this code to the parent/guardian</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="flex gap-3 justify-center">
          <button
            onClick={printLabel}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--border)]
              bg-[var(--card)] text-[var(--foreground)] text-sm font-medium
              hover:bg-[var(--muted)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Label
          </button>
          <button
            onClick={onAnother}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--primary)]
              text-[var(--primary-foreground)] text-sm font-semibold
              hover:bg-[var(--primary)]/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Check In Another
          </button>
        </div>

        {household && onSiblingCheckIn && (
          <button
            onClick={() => onSiblingCheckIn(household)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--primary)]/30
              bg-[var(--primary)]/5 text-[var(--primary)] text-sm font-semibold
              hover:bg-[var(--primary)]/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Check In Another {household.last_name} Child
          </button>
        )}
      </div>
    </div>
  )
}
