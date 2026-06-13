import QRCode from 'qrcode'

export async function printCheckinLabel(checkin, showCheckout = true, churchName = 'Kids Ministry') {
  const guardianLine = checkin.guardian_name
    ? `<div class="guardian">Guardian: ${checkin.guardian_name}</div>`
    : ''

  const qrImgTag = showCheckout
    ? `<img src="${await QRCode.toDataURL(checkin.pickup_code, {
        width: 80, margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })}" width="80" height="80" />`
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
          <span class="app-name">${churchName}</span>
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
