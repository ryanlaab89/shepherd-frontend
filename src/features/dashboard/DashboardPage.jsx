import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@apollo/client'
import { useToast } from '@/contexts/ToastContext'
import {
  TODAY_CHECKINS_QUERY,
  CHURCH_SETTINGS_QUERY,
  TODAY_CLASS_SESSIONS_QUERY,
  SERVICES_QUERY,
  USERS_QUERY,
  SCHEDULES_QUERY,
  ME_QUERY,
  CLASSES_QUERY,
} from '@/graphql/queries'
import {
  SET_CLASS_SESSION_MUTATION,
  DELETE_CHECKIN_MUTATION,
  AUTO_CHECKOUT_SERVICE_MUTATION,
  CHECK_OUT_MUTATION,
  UPDATE_CHECKIN_MUTATION,
} from '@/graphql/mutations'
import { detectActiveService } from '@/lib/serviceUtils'
import { isValidPhone } from '@/lib/validators'
import { printCheckinLabel } from '@/lib/printLabel'
import PhoneInput from '@/components/PhoneInput'

function calcAge(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}
function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(dt) {
  if (!dt) return null
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function DashboardPage() {
  const toast = useToast()
  const [search,          setSearch]          = useState('')
  const [filterServiceId, setFilterServiceId] = useState('')
  const [filterClassId,   setFilterClassId]   = useState('')
  const [sortField,       setSortField]       = useState('time')
  const [sortDir,         setSortDir]         = useState('desc')
  const [autoService,     setAutoService]     = useState(null)
  const [pendingDelete,   setPendingDelete]   = useState(null)
  const [pendingCheckout, setPendingCheckout] = useState(null)
  const [autoCheckoutMsg, setAutoCheckoutMsg] = useState('')
  const [selected,        setSelected]        = useState(new Set())
  const [batchLoading,    setBatchLoading]    = useState(false)
  const [quickCode,       setQuickCode]       = useState('')
  const [quickLoading,    setQuickLoading]    = useState(false)
  const [view,            setView]            = useState('table') // 'table' | 'summary'
  const [detailCheckin,   setDetailCheckin]   = useState(null)
  const [editCheckin,     setEditCheckin]     = useState(null) // { id, guardianName, guardianPhone, serviceId }
  const [editSaving,      setEditSaving]      = useState(false)
  const prevServiceRef = useRef(null)
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  const navigate = useNavigate()

  const { data: classData  } = useQuery(TODAY_CLASS_SESSIONS_QUERY, { fetchPolicy: 'cache-and-network', pollInterval: 60000 })
  const { data: usersData  } = useQuery(USERS_QUERY)
  const { data: servicesData } = useQuery(SERVICES_QUERY)
  const { data: settingsData } = useQuery(CHURCH_SETTINGS_QUERY)
  const { data: schedulesData } = useQuery(SCHEDULES_QUERY, { variables: { date: today }, fetchPolicy: 'cache-and-network' })
  const { data: meData }        = useQuery(ME_QUERY)
  const { data: allClassesData } = useQuery(CLASSES_QUERY)

  const classMetaMap = useMemo(() => {
    const map = {}
    for (const cls of (allClassesData?.classes ?? [])) {
      let ageRange = null
      if (cls.min_age !== null && cls.max_age !== null) ageRange = `${cls.min_age}–${cls.max_age} yrs`
      else if (cls.min_age !== null) ageRange = `${cls.min_age}+ yrs`
      else if (cls.max_age !== null) ageRange = `Up to ${cls.max_age} yrs`
      map[cls.name] = { ageRange, description: cls.description ?? null }
    }
    return map
  }, [allClassesData])

  const classes    = classData?.todayClassSessions ?? []
  const staffList  = usersData?.users ?? []
  const allServices = servicesData?.services ?? []
  const schedules   = schedulesData?.schedules ?? []
  const showCheckout = (settingsData?.churchSettings?.show_checkout ?? true) ||
                       (settingsData?.churchSettings?.require_checkout ?? false)

  const { data: todayData, loading, refetch } = useQuery(TODAY_CHECKINS_QUERY, { fetchPolicy: 'cache-and-network', pollInterval: 30000 })
  const rawList = todayData?.todayCheckins ?? []

  // Stats derived from live data
  const totalToday  = rawList.length
  const currentlyIn = rawList.filter(r => !r.checked_out_at).length
  const checkedOut  = totalToday - currentlyIn
  const byService   = Object.values(
    rawList.reduce((acc, c) => {
      if (!c.checked_out_at) {
        const key = c.service.id
        if (!acc[key]) acc[key] = { service_name: c.service.name, count: 0 }
        acc[key].count++
      }
      return acc
    }, {})
  )

  const refetchAll = { refetchQueries: [{ query: TODAY_CHECKINS_QUERY }], awaitRefetchQueries: true }

  const [deleteCheckin,       { loading: deleting     }] = useMutation(DELETE_CHECKIN_MUTATION,       refetchAll)
  const [checkOutMutation,    { loading: checkingOut  }] = useMutation(CHECK_OUT_MUTATION,            refetchAll)
  const [autoCheckoutService]                            = useMutation(AUTO_CHECKOUT_SERVICE_MUTATION, { refetchQueries: [{ query: TODAY_CHECKINS_QUERY }] })
  const [updateCheckinMutation]                          = useMutation(UPDATE_CHECKIN_MUTATION,        refetchAll)

  // Auto-checkout when service ends (only when checkout is disabled — system manages it)
  useEffect(() => {
    if (showCheckout) return
    if (!allServices.length) return
    function tick() {
      const result = detectActiveService(allServices)
      const currentId = result?.service?.id ?? null
      const prev = prevServiceRef.current
      if (prev !== null && prev !== currentId) {
        autoCheckoutService({ variables: { serviceId: prev } })
          .then(({ data }) => {
            const count = data?.autoCheckoutService ?? 0
            if (count > 0) {
              const name = allServices.find(s => s.id === prev)?.name ?? 'previous service'
              setAutoCheckoutMsg(`Auto-checked out ${count} ${count === 1 ? 'child' : 'children'} from ${name}`)
              setTimeout(() => setAutoCheckoutMsg(''), 6000)
            }
          }).catch(() => {})
      }
      prevServiceRef.current = currentId
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [allServices.length, showCheckout]) // eslint-disable-line

  useEffect(() => {
    const result = detectActiveService(allServices)
    const id = result?.service?.id ?? null
    setAutoService(id)
    if (id && filterServiceId === '') setFilterServiceId(id)
  }, [allServices.length]) // eslint-disable-line

  // Filter + sort
  const serviceOptions = Array.from(new Map(rawList.map(c => [c.service.id, c.service])).values())
    .sort((a, b) => a.name.localeCompare(b.name))
  const classOptions = Array.from(
    new Map(rawList.filter(c => c.classGroup).map(c => [c.classGroup.id, c.classGroup])).values()
  ).sort((a, b) => a.name.localeCompare(b.name))

  const q = search.trim().toLowerCase()
  let checkins = rawList
  if (filterServiceId) checkins = checkins.filter(c => c.service.id === filterServiceId)
  if (filterClassId)   checkins = checkins.filter(c => c.classGroup?.id === filterClassId)
  if (q) checkins = checkins.filter(c =>
    `${c.person.first_name} ${c.person.last_name}`.toLowerCase().includes(q) ||
    (c.guardian_name ?? '').toLowerCase().includes(q)
  )

  checkins = [...checkins].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'name':
        cmp = `${a.person.first_name} ${a.person.last_name}`
          .localeCompare(`${b.person.first_name} ${b.person.last_name}`)
        break
      case 'class':
        cmp = (a.classGroup?.name ?? '').localeCompare(b.classGroup?.name ?? '')
        break
      case 'guardian':
        cmp = (a.guardian_name ?? '').localeCompare(b.guardian_name ?? '')
        break
      case 'service':
        cmp = (a.service?.name ?? '').localeCompare(b.service?.name ?? '')
        break
      case 'checkout':
        if (!a.checked_out_at && !b.checked_out_at) cmp = 0
        else if (!a.checked_out_at) cmp = 1
        else if (!b.checked_out_at) cmp = -1
        else cmp = new Date(a.checked_out_at) - new Date(b.checked_out_at)
        break
      default:
        cmp = new Date(a.checked_in_at) - new Date(b.checked_in_at)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'time' || field === 'checkout' ? 'desc' : 'asc') }
  }

  // Multi-select
  const visibleIds  = checkins.map(c => c.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
  const someSelected = visibleIds.some(id => selected.has(id)) && !allSelected

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) visibleIds.forEach(id => next.delete(id))
      else             visibleIds.forEach(id => next.add(id))
      return next
    })
  }
  function toggleRow(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const selectedList = [...selected]
  const selectedActive = selectedList.filter(id => {
    const row = rawList.find(r => r.id === id)
    return row && !row.checked_out_at
  })

  async function handleBatchCheckout() {
    setBatchLoading(true)
    await Promise.allSettled(selectedActive.map(id => checkOutMutation({ variables: { checkinId: id } })))
    await refetch()
    setSelected(new Set())
    setPendingCheckout(null)
    setBatchLoading(false)
  }

  async function handleBatchDelete() {
    setBatchLoading(true)
    await Promise.allSettled(selectedList.map(id => deleteCheckin({ variables: { checkinId: id } })))
    await refetch()
    setSelected(new Set())
    setPendingDelete(null)
    setBatchLoading(false)
  }

  async function handleQuickCheckout(e) {
    e.preventDefault()
    const code = quickCode.trim().toUpperCase()
    if (!code) return
    const match = rawList.find(c => c.pickup_code === code && !c.checked_out_at)
    if (!match) {
      toast?.error(`No active check-in found for code "${code}"`)
      return
    }
    setQuickLoading(true)
    try {
      await checkOutMutation({ variables: { checkinId: match.id } })
      toast?.success(`${match.person.first_name} ${match.person.last_name} checked out`)
      setQuickCode('')
    } catch (err) {
      toast?.error(err.message || 'Could not check out')
    } finally {
      setQuickLoading(false)
    }
  }

  function exportCSV() {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const headers = showCheckout
      ? ['Child', 'Class', 'Guardian', 'Phone', 'Service', 'Code', 'In', 'Out']
      : ['Child', 'Class', 'Guardian', 'Phone', 'Service', 'In']
    const rows = checkins.map(c => {
      const base = [
        `${c.person.first_name} ${c.person.last_name}`,
        c.classGroup?.name ?? '',
        c.guardian_name ?? '',
        c.guardian_phone ?? '',
        c.service.name,
      ]
      if (showCheckout) {
        base.push(c.pickup_code ?? '', fmtTime(c.checked_in_at) ?? '', c.checked_out_at ? (fmtTime(c.checked_out_at) ?? '') : '')
      } else {
        base.push(fmtTime(c.checked_in_at) ?? '')
      }
      return base
    })
    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `attendance-${date.replace(/[, ]+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editCheckin) return
    setEditSaving(true)
    try {
      await updateCheckinMutation({ variables: {
        checkinId:    editCheckin.id,
        guardianName: editCheckin.guardianName || null,
        guardianPhone: editCheckin.guardianPhone || null,
        serviceId:    editCheckin.serviceId || null,
      }})
      toast?.success('Check-in updated')
      setEditCheckin(null)
    } catch (err) {
      toast?.error(err.message || 'Could not update check-in')
    } finally {
      setEditSaving(false)
    }
  }

  function printReport() {
    const churchName = meData?.me?.church?.name ?? 'Kids Ministry'
    const dateStr    = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const timeStr    = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const servicesInData = Array.from(new Map(rawList.map(c => [c.service.id, c.service])).values())
      .sort((a, b) => a.name.localeCompare(b.name))

    function summarise(rows, svcId) {
      const r   = svcId ? rows.filter(c => c.service.id === svcId) : rows
      const sch = svcId ? schedules.filter(s => s.service?.id === svcId) : schedules
      const byClass = {}
      r.forEach(c => { const n = c.classGroup?.name ?? 'Unassigned'; byClass[n] = (byClass[n] || 0) + 1 })
      return {
        total: r.length,
        stillHere: r.filter(c => !c.checked_out_at).length,
        checkedOut: r.filter(c => c.checked_out_at).length,
        byClass,
        guardians:  new Set(r.filter(c => c.guardian_name).map(c => c.guardian_name)).size,
        volunteers: new Set(sch.map(s => s.user.id)).size,
      }
    }

    const CLASS_ORDER_PRINT = ['Toddler', 'Pre School', 'Primary', 'Pre Teens']

    function classRows(byClass) {
      const order = [...CLASS_ORDER_PRINT, ...Object.keys(byClass).filter(k => !CLASS_ORDER_PRINT.includes(k))]
      return order.filter(k => byClass[k])
        .map(k => {
          const range = classMetaMap[k]?.ageRange
          return `<tr><td>${k}${range ? ` <span class="age">(${range})</span>` : ''}</td><td class="num-cell">${byClass[k]}</td></tr>`
        })
        .join('')
    }

    function summaryCard(title, s, highlight) {
      return `
        <div class="card${highlight ? ' card-highlight' : ''}">
          <h3>${title}</h3>
          <div class="trio">
            <div class="stat"><div class="num">${s.total}</div><div class="lbl">Total Kids</div></div>
            <div class="stat"><div class="num">${s.stillHere}</div><div class="lbl">Still Here</div></div>
            <div class="stat"><div class="num">${s.checkedOut}</div><div class="lbl">Checked Out</div></div>
          </div>
          ${Object.keys(s.byClass).length ? `
          <table class="ag">
            <thead><tr><th>Age Group</th><th>Kids</th></tr></thead>
            <tbody>${classRows(s.byClass)}</tbody>
          </table>` : ''}
          <div class="footer-row">
            <span>Guardians: <strong>${s.guardians}</strong></span>
            <span>Volunteers: <strong>${s.volunteers}</strong></span>
          </div>
        </div>`
    }

    // Detailed children list grouped by service
    function childRow(c) {
      const outCell = showCheckout
        ? `<td>${c.checked_out_at ? new Date(c.checked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '<span class="here">Here</span>'}</td>`
        : ''
      return `<tr>
        <td><strong>${c.person.first_name} ${c.person.last_name}</strong>${c.person.medical_notes ? ' <span class="med">⚠</span>' : ''}</td>
        <td>${c.classGroup?.name ?? '—'}</td>
        <td>${c.guardian_name ?? '—'}</td>
        <td>${c.guardian_phone ?? '—'}</td>
        <td>${new Date(c.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        ${outCell}
      </tr>`
    }

    function serviceDetailSection(svc) {
      const rows = rawList.filter(c => c.service.id === svc.id)
        .sort((a, b) => `${a.person.first_name} ${a.person.last_name}`.localeCompare(`${b.person.first_name} ${b.person.last_name}`))
      const outHeader = showCheckout ? '<th>Out</th>' : ''
      return `
        <div class="detail-section">
          <div class="svc-header">
            <span class="svc-name">${svc.name}</span>
            <span class="svc-count">${rows.length} children</span>
          </div>
          <table class="detail-table">
            <thead><tr><th>Child</th><th>Class</th><th>Guardian</th><th>Phone</th><th>In</th>${outHeader}</tr></thead>
            <tbody>${rows.map(childRow).join('')}</tbody>
          </table>
        </div>`
    }

    const allDay     = summarise(rawList, null)
    const svcCards   = servicesInData.map(s => summaryCard(s.name, summarise(rawList, s.id), false)).join('')
    const detailSections = servicesInData.map(serviceDetailSection).join('')

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Attendance Report — ${dateStr}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;padding:32px;color:#0f172a;font-size:13px}

      /* Header */
      .header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1A3A8C}
      .header-left .org{font-size:11px;font-weight:700;color:#1A3A8C;text-transform:uppercase;letter-spacing:.1em}
      .header-left .title{font-size:22px;font-weight:800;color:#0f172a;margin-top:2px}
      .header-left .date{font-size:13px;color:#64748b;margin-top:3px}
      .header-right{text-align:right;font-size:11px;color:#94a3b8;line-height:1.8}
      .header-right strong{color:#64748b}

      /* Section labels */
      .section-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#1A3A8C;
        margin:28px 0 12px;padding-bottom:6px;border-bottom:1.5px solid #e2e8f0}

      /* Summary cards */
      .card{border:1.5px solid #e2e8f0;border-radius:10px;padding:16px;break-inside:avoid;margin-bottom:12px}
      .card-highlight{border-color:#1A3A8C;background:#f8faff}
      .card h3{font-size:14px;font-weight:700;margin-bottom:10px}
      .trio{display:flex;gap:10px;margin-bottom:12px}
      .stat{flex:1;background:#f8fafc;border-radius:7px;padding:8px;text-align:center}
      .card-highlight .stat{background:#eef2ff}
      .num{font-size:22px;font-weight:800;color:#1A3A8C}
      .lbl{font-size:10px;color:#64748b;margin-top:1px}
      .ag{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px}
      .ag th{text-align:left;padding:5px 8px;background:#f1f5f9;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
      .ag td{padding:4px 8px;border-top:1px solid #f1f5f9}
      .num-cell{font-weight:700;text-align:right}
      .age{color:#94a3b8;font-size:11px}
      .footer-row{display:flex;gap:16px;font-size:11px;color:#64748b;padding-top:8px;border-top:1px solid #f1f5f9}
      .footer-row strong{color:#0f172a}
      .card-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}

      /* Detail section */
      .detail-section{break-inside:avoid;margin-bottom:20px}
      .svc-header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px}
      .svc-name{font-size:13px;font-weight:700;color:#0f172a}
      .svc-count{font-size:11px;color:#64748b}
      .detail-table{width:100%;border-collapse:collapse;font-size:12px}
      .detail-table th{text-align:left;padding:6px 8px;background:#f8fafc;font-weight:600;font-size:10px;
        text-transform:uppercase;letter-spacing:.05em;border-bottom:1.5px solid #e2e8f0}
      .detail-table td{padding:5px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
      .detail-table tr:last-child td{border-bottom:none}
      .detail-table tr:hover{background:#f8fafc}
      .here{display:inline-block;padding:1px 6px;border-radius:10px;background:#dcfce7;color:#16a34a;font-size:10px;font-weight:600}
      .med{color:#d97706;font-size:11px}

      @media print{body{padding:16px} .card-grid{grid-template-columns:1fr 1fr}}
    </style></head><body>

      <!-- Header -->
      <div class="header">
        <div class="header-left">
          <div class="org">${churchName}</div>
          <div class="title">Kids Ministry Attendance</div>
          <div class="date">${dateStr}</div>
        </div>
        <div class="header-right">
          <div>Printed: <strong>${timeStr}</strong></div>
          <div>Total Kids: <strong>${rawList.length}</strong></div>
          <div>Services: <strong>${servicesInData.length}</strong></div>
        </div>
      </div>

      <!-- Whole Day Summary -->
      <div class="section-label">Whole Day Summary</div>
      ${summaryCard('All Services Combined', allDay, true)}

      <!-- Per Service Summary -->
      ${servicesInData.length > 1 ? `<div class="section-label">Per Service Summary</div><div class="card-grid">${svcCards}</div>` : ''}

      <!-- Detailed Attendance List -->
      <div class="section-label">Attendance List</div>
      ${detailSections}

      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const isAutoService = filterServiceId === autoService && !!autoService

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => navigate('/checkin')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-sm font-semibold flex-shrink-0 whitespace-nowrap
            hover:bg-[var(--primary)]/90 active:scale-95 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Check In
        </button>
      </div>

      {/* Stat cards */}
      <div className={`grid gap-2 sm:gap-4 mb-8 ${showCheckout ? 'grid-cols-3' : 'grid-cols-1 max-w-xs'}`}>
        <StatCard label="Checked In Today" value={loading ? '—' : totalToday} color="primary"
          icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        {showCheckout && <>
          <StatCard label="Still Here" value={loading ? '—' : currentlyIn} color="accent"
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
          <StatCard label="Checked Out" value={loading ? '—' : checkedOut} color="muted"
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} />
        </>}
      </div>

      {/* Today's Classes */}
      {classes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Today's Classes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {classes.map(cls => <ClassSessionCard key={cls.id} cls={cls} staffList={staffList} />)}
          </div>
        </div>
      )}

      {/* By service */}
      {byService.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Active by Service</h2>
          <div className="flex flex-wrap gap-2">
            {byService.map(row => (
              <div key={row.service_name}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--secondary)] border border-[var(--border)]">
                <span className="text-sm text-[var(--foreground)]">{row.service_name}</span>
                <span className="text-sm font-bold text-[var(--primary)]">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {autoCheckoutMsg && (
        <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl
          bg-emerald-50 border border-emerald-200 text-emerald-800
          dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium">{autoCheckoutMsg}</p>
        </div>
      )}

      {/* Attendance table */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Today's Attendance</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)] hidden sm:inline">Auto-refreshes every 30s</span>
            {/* View toggle */}
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-xs font-medium">
              <button
                onClick={() => setView('table')}
                className={`px-3 py-1.5 transition-colors ${view === 'table'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              >Table</button>
              <button
                onClick={() => setView('summary')}
                className={`px-3 py-1.5 transition-colors border-l border-[var(--border)] ${view === 'summary'
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              >Summary</button>
            </div>
            <button
              onClick={printReport}
              disabled={rawList.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)]
                text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)]/50
                disabled:opacity-40 transition-colors"
              title="Print attendance report with summary + full children list"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span className="hidden sm:inline">Print Report</span>
            </button>
            {view === 'table' && checkins.length > 0 && (
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)]
                  text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--primary)]/50
                  transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary view */}
        {view === 'summary' && (
          <SummaryView rawList={rawList} schedules={schedules} classMetaMap={classMetaMap} />
        )}

        {/* Quick checkout by pickup code */}
        {view === 'table' && showCheckout && (
          <form onSubmit={handleQuickCheckout} className="flex items-center gap-2 mb-3">
            <div className="relative">
              <input
                value={quickCode}
                onChange={e => setQuickCode(e.target.value.toUpperCase())}
                placeholder="Pickup code…"
                maxLength={6}
                className="w-36 pl-3 pr-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
                  text-[var(--foreground)] text-sm uppercase tracking-widest font-mono placeholder:normal-case
                  placeholder:tracking-normal placeholder:text-[var(--muted-foreground)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={quickLoading || !quickCode.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--primary)]
                text-[var(--primary-foreground)] text-xs font-semibold
                hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors"
            >
              {quickLoading ? <Spinner sm /> : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7" />
                </svg>
              )}
              Quick Check Out
            </button>
          </form>
        )}

        {/* Filters + table — hidden in summary mode */}
        {view === 'table' && <><div className="flex flex-wrap gap-2 mb-3">
          <div className="relative">
            <select value={filterServiceId} onChange={e => setFilterServiceId(e.target.value)} className={filterSelect}>
              <option value="">All services</option>
              {serviceOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {isAutoService && (
              <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 py-0.5 rounded-full
                bg-[var(--primary)] text-[var(--primary-foreground)] leading-none pointer-events-none">Auto</span>
            )}
          </div>
          <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} className={filterSelect}>
            <option value="">All classes</option>
            {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative flex-1 min-w-[160px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or guardian…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
                text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]
                focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors" />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {(filterServiceId || filterClassId) && (
            <button onClick={() => { setFilterServiceId(''); setFilterClassId('') }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-[var(--border)]
                text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>

        {/* Batch action bar */}
        {selected.size > 0 && (
          <BatchBar
            count={selected.size}
            activeCount={selectedActive.length}
            showCheckout={showCheckout}
            loading={batchLoading}
            onCheckout={handleBatchCheckout}
            onDelete={handleBatchDelete}
            onClear={() => setSelected(new Set())}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--muted-foreground)]"><Spinner /></div>
        ) : checkins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--muted-foreground)]
            border border-dashed border-[var(--border)] rounded-xl">
            <p className="text-sm">
              {q || filterServiceId || filterClassId ? 'No children match the filters' : 'No children checked in yet'}
            </p>
          </div>
        ) : (
          <>
          {/* Mobile card layout */}
          <div className="md:hidden rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
            {checkins.map(c => (
              <MobileCheckinCard
                key={c.id}
                c={c}
                showCheckout={showCheckout}
                isSelecting={selected.has(c.id)}
                isDeleting={pendingDelete === c.id}
                isCheckingOut={pendingCheckout === c.id}
                deleting={deleting}
                checkingOut={checkingOut}
                onToggle={toggleRow}
                onExpand={() => setDetailCheckin(c)}
                onCheckout={() => setPendingCheckout(c.id)}
                onCheckoutConfirm={() => { checkOutMutation({ variables: { checkinId: c.id } }); setPendingCheckout(null) }}
                onDelete={() => setPendingDelete(c.id)}
                onDeleteConfirm={() => deleteCheckin({ variables: { checkinId: c.id } })}
                onCancel={() => { setPendingDelete(null); setPendingCheckout(null) }}
              />
            ))}
            <div className="px-4 py-2 bg-[var(--muted)]/30 text-xs text-[var(--muted-foreground)]">
              {checkins.length} record{checkins.length !== 1 ? 's' : ''}
              {(filterServiceId || filterClassId || q) ? ' (filtered)' : ''}
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                  <th className="px-3 py-3 w-10">
                    <IndeterminateCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  <SortTh label="Child"    field="name"     {...{ sortField, sortDir, toggleSort }} />
                  <SortTh label="Class"    field="class"    {...{ sortField, sortDir, toggleSort }} />
                  <SortTh label="Guardian" field="guardian" {...{ sortField, sortDir, toggleSort }} />
                  <SortTh label="Service"  field="service"  {...{ sortField, sortDir, toggleSort }} />
                  {showCheckout && (
                    <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">Code</th>
                  )}
                  <SortTh label="In"  field="time"     {...{ sortField, sortDir, toggleSort }} />
                  {showCheckout && (
                    <SortTh label="Out" field="checkout" {...{ sortField, sortDir, toggleSort }} />
                  )}
                  <th className="px-3 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {checkins.map(c => {
                  const isActive      = !c.checked_out_at
                  const isSelecting   = selected.has(c.id)
                  const isDeleting    = pendingDelete   === c.id
                  const isCheckingOut = pendingCheckout === c.id
                  const colSpan       = showCheckout ? 9 : 7

                  return (
                    <Fragment key={c.id}>
                    <tr
                      onClick={e => { if (e.target.closest('button,input')) return; setDetailCheckin(c) }}
                      className={`transition-colors cursor-pointer ${
                        isDeleting    ? 'bg-red-50 dark:bg-red-900/10' :
                        isCheckingOut ? 'bg-[var(--primary)]/5' :
                        isSelecting   ? 'bg-[var(--primary)]/5' :
                        'bg-[var(--card)] hover:bg-[var(--muted)]/40'
                      }`}>
                      <td className="px-3 py-4 text-center">
                        <input type="checkbox" checked={isSelecting} onChange={() => toggleRow(c.id)}
                          className="rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                            text-sm font-bold text-[var(--primary)] flex-shrink-0">
                            {c.person.first_name[0]}
                          </div>
                          <span className="font-medium text-[var(--foreground)]">
                            {c.person.first_name} {c.person.last_name}
                          </span>
                          {c.person.medical_notes && (
                            <span title={c.person.medical_notes}
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full
                                bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400
                                flex-shrink-0 cursor-help">
                              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {c.classGroup
                          ? <span className="text-xs font-medium px-2 py-0.5 rounded-full
                              bg-[var(--primary)]/10 text-[var(--primary)]">{c.classGroup.name}</span>
                          : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                      </td>
                      <td className="px-4 py-4">
                        {c.guardian_name || c.guardian_phone
                          ? <div>
                              {c.guardian_name && <p className="text-sm text-[var(--foreground)]">{c.guardian_name}</p>}
                              {c.guardian_phone && <p className="text-xs text-[var(--muted-foreground)]">{c.guardian_phone}</p>}
                            </div>
                          : <span className="text-xs text-[var(--muted-foreground)]">—</span>}
                      </td>
                      <td className="px-4 py-4 text-[var(--muted-foreground)] text-sm">{c.service.name}</td>
                      {showCheckout && (
                        <td className="px-4 py-4">
                          <span className="font-mono font-bold text-[var(--primary)] tracking-widest text-sm">
                            {c.pickup_code}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-4 text-[var(--muted-foreground)] text-sm">{fmtTime(c.checked_in_at)}</td>
                      {showCheckout && (
                        <td className="px-4 py-4 text-sm">
                          {c.checked_out_at
                            ? <span className="text-[var(--muted-foreground)]">{fmtTime(c.checked_out_at)}</span>
                            : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5
                                rounded-full bg-emerald-100 text-emerald-700
                                dark:bg-emerald-900/30 dark:text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Here
                              </span>}
                        </td>
                      )}
                      <td className="px-2 py-4 text-right">
                        <RowActions
                          isActive={isActive}
                          showCheckout={showCheckout}
                          isDeleting={isDeleting}
                          isCheckingOut={isCheckingOut}
                          deleting={deleting}
                          checkingOut={checkingOut}
                          onCheckout={() => setPendingCheckout(c.id)}
                          onCheckoutConfirm={() => { checkOutMutation({ variables: { checkinId: c.id } }); setPendingCheckout(null) }}
                          onDelete={() => setPendingDelete(c.id)}
                          onDeleteConfirm={() => deleteCheckin({ variables: { checkinId: c.id } })}
                          onCancel={() => { setPendingDelete(null); setPendingCheckout(null) }}
                          onExpand={() => setDetailCheckin(c)}
                          onReprint={() => printCheckinLabel(c, showCheckout, meData?.me?.church?.name ?? '')}
                          onEdit={() => { setDetailCheckin(c); setEditCheckin({ id: c.id, guardianName: c.guardian_name ?? '', guardianPhone: c.guardian_phone ?? '', serviceId: c.service.id }) }}
                        />
                      </td>
                    </tr>

                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--muted)]/30
              text-xs text-[var(--muted-foreground)]">
              {checkins.length} record{checkins.length !== 1 ? 's' : ''}
              {(filterServiceId || filterClassId || q) ? ' (filtered)' : ''}
            </div>
          </div>
          </>
        )}
      </>}
      </div>

      {detailCheckin && (
        <DetailsModal
          c={detailCheckin}
          showCheckout={showCheckout}
          editCheckin={editCheckin?.id === detailCheckin.id ? editCheckin : null}
          editSaving={editSaving}
          allServices={allServices}
          churchName={meData?.me?.church?.name ?? ''}
          onEdit={() => setEditCheckin({ id: detailCheckin.id, guardianName: detailCheckin.guardian_name ?? '', guardianPhone: detailCheckin.guardian_phone ?? '', serviceId: detailCheckin.service.id })}
          onEditChange={patch => setEditCheckin(p => ({ ...p, ...patch }))}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={() => setEditCheckin(null)}
          onReprint={() => printCheckinLabel(detailCheckin, showCheckout, meData?.me?.church?.name ?? '')}
          onClose={() => { setDetailCheckin(null); setEditCheckin(null) }}
        />
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function BatchBar({ count, activeCount, showCheckout, loading, onCheckout, onDelete, onClear }) {
  return (
    <div className="mb-3 flex items-center gap-2 flex-wrap px-3 py-2.5 rounded-lg
      bg-[var(--primary)]/5 border border-[var(--primary)]/20">
      <span className="text-sm font-medium text-[var(--primary)] mr-1">
        {count} selected
      </span>
      {showCheckout && activeCount > 0 && (
        <button onClick={onCheckout} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)]
            text-[var(--primary-foreground)] text-xs font-semibold
            hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">
          {loading ? <Spinner sm /> : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7" />
            </svg>
          )}
          Check Out {activeCount > 1 ? `(${activeCount})` : ''}
        </button>
      )}
      <button onClick={onDelete} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300
          text-red-600 dark:border-red-700 dark:text-red-400 text-xs font-semibold
          hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors">
        {loading ? <Spinner sm /> : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
        Delete ({count})
      </button>
      <button onClick={onClear}
        className="ml-auto text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
        Clear selection
      </button>
    </div>
  )
}

function DetailsModal({ c, showCheckout, editCheckin, editSaving, allServices, churchName,
  onEdit, onEditChange, onSaveEdit, onCancelEdit, onReprint, onClose }) {
  const isEditing = !!editCheckin

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const fieldCls = `mt-1 w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
    text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]
    focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 transition-colors`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
      bg-black/50 backdrop-blur-sm" onClick={onClose}>

      {/* Panel */}
      <div className="w-full max-w-xl bg-[var(--card)] rounded-2xl shadow-2xl
        border border-[var(--border)] overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="w-9 h-9 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
            text-sm font-bold text-[var(--primary)] flex-shrink-0">
            {c.person.first_name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--foreground)] truncate">
              {c.person.first_name} {c.person.last_name}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {c.service.name}{c.classGroup ? ` · ${c.classGroup.name}` : ''}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Child details */}
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
              Child Details
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Age</p>
                <p className="text-[var(--foreground)] font-medium">
                  {calcAge(c.person.date_of_birth) != null ? `${calcAge(c.person.date_of_birth)} yrs` : '—'}
                  {c.person.date_of_birth && (
                    <span className="text-[var(--muted-foreground)] font-normal ml-1 text-xs">
                      ({fmtDate(c.person.date_of_birth)})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Class</p>
                <p className="text-[var(--foreground)] font-medium">{c.classGroup?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Family</p>
                <p className="text-[var(--foreground)] font-medium">{c.person.household?.last_name ?? '—'}</p>
                {c.person.household?.phone && (
                  <p className="text-xs text-[var(--muted-foreground)]">{c.person.household.phone}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Total Visits</p>
                <p className="text-[var(--foreground)] font-medium">{c.person.checkins_count ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Last Visit</p>
                <p className="text-[var(--foreground)] font-medium">{fmtDate(c.person.last_checkin_at)}</p>
              </div>
            </div>
            {c.person.medical_notes && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200
                dark:bg-amber-900/20 dark:border-amber-700">
                <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-0.5">
                  Medical Notes
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">{c.person.medical_notes}</p>
              </div>
            )}
          </div>

          {/* Check-in info / edit */}
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
              {isEditing ? 'Edit Check-In' : 'Check-In Info'}
            </p>
            {isEditing ? (
              <form onSubmit={onSaveEdit} className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Guardian Name</label>
                  <input value={editCheckin.guardianName}
                    onChange={e => onEditChange({ guardianName: e.target.value })}
                    placeholder="Guardian name" className={fieldCls} />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Guardian Phone</label>
                  <input value={editCheckin.guardianPhone}
                    onChange={e => onEditChange({ guardianPhone: e.target.value })}
                    placeholder="Guardian phone" className={fieldCls} />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Service</label>
                  <select value={editCheckin.serviceId}
                    onChange={e => onEditChange({ serviceId: e.target.value })}
                    className={fieldCls}>
                    {allServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={onCancelEdit}
                    className="flex-1 py-2 rounded-lg border border-[var(--border)] text-xs
                      text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={editSaving}
                    className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                      text-xs font-semibold hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Guardian</p>
                  <p className="text-[var(--foreground)]">{c.guardian_name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Phone</p>
                  <p className="text-[var(--foreground)]">{c.guardian_phone || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Service</p>
                  <p className="text-[var(--foreground)]">{c.service.name}</p>
                </div>
                {showCheckout && c.pickup_code && (
                  <div>
                    <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">Code</p>
                    <p className="font-mono font-bold text-[var(--primary)] tracking-widest">{c.pickup_code}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        {!isEditing && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--border)] bg-[var(--muted)]/30">
            <button onClick={onReprint}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)]
                bg-[var(--card)] text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Reprint Sticker
            </button>
            <button onClick={onEdit}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)]
                bg-[var(--card)] text-sm text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Check-In
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RowActions({ isActive, showCheckout, isDeleting, isCheckingOut, deleting, checkingOut,
  onCheckout, onCheckoutConfirm, onDelete, onDeleteConfirm, onCancel, onReprint, onEdit, onExpand }) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef(null)
  const dropRef = useRef(null)
  useEffect(() => {
    if (!open) return
    function close(e) {
      if (btnRef.current && btnRef.current.contains(e.target)) return
      if (dropRef.current && dropRef.current.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuHeight = 220 // approximate max height of dropdown
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow >= menuHeight
        ? rect.bottom + 4
        : rect.top - menuHeight - 4
      setDropPos({ top, right: window.innerWidth - rect.right })
    }
    setOpen(v => !v)
  }

  if (isCheckingOut) return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={onCheckoutConfirm} disabled={checkingOut}
        className="px-2 py-1 rounded bg-[var(--primary)] text-[var(--primary-foreground)]
          text-[10px] font-semibold hover:bg-[var(--primary)]/90 disabled:opacity-50 whitespace-nowrap">
        {checkingOut ? '…' : 'Confirm'}
      </button>
      <button onClick={onCancel}
        className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
          text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
    </div>
  )
  if (isDeleting) return (
    <div className="flex items-center justify-end gap-1">
      <button onClick={onDeleteConfirm} disabled={deleting}
        className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold
          hover:bg-red-700 disabled:opacity-50 whitespace-nowrap">
        {deleting ? '…' : 'Remove'}
      </button>
      <button onClick={onCancel}
        className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
          text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
    </div>
  )

  function act(fn) { fn(); setOpen(false) }

  return (
    <div className="flex justify-end">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)]
          hover:bg-[var(--muted)] transition-colors"
        title="Actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right }}
          className="z-50 w-44 rounded-xl border border-[var(--border)]
          bg-[var(--card)] shadow-lg overflow-hidden">
          <button onClick={() => act(onExpand)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors text-left">
            <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Details
          </button>
          <button onClick={() => act(onEdit)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors text-left">
            <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Check-In
          </button>
          <button onClick={() => act(onReprint)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors text-left">
            <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Reprint Sticker
          </button>
          {showCheckout && isActive && (
            <button onClick={() => act(onCheckout)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--primary)]
                hover:bg-[var(--primary)]/5 transition-colors text-left">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
              Check Out
            </button>
          )}
          <div className="border-t border-[var(--border)] my-0.5" />
          <button onClick={() => act(onDelete)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400
              hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Remove Record
          </button>
        </div>
      )}
    </div>
  )
}

function IndeterminateCheckbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      className="rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer" />
  )
}

function SortTh({ label, field, sortField, sortDir, toggleSort }) {
  const active = sortField === field
  return (
    <th className="text-left px-4 py-3 font-medium text-[var(--muted-foreground)]">
      <button onClick={() => toggleSort(field)}
        className={`flex items-center gap-1 hover:text-[var(--foreground)] transition-colors ${active ? 'text-[var(--foreground)]' : ''}`}>
        {label}
        <span className={active ? 'opacity-100' : 'opacity-30'}>
          {active && sortDir === 'asc'
            ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
            : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>}
        </span>
      </button>
    </th>
  )
}

function StatCard({ label, value, icon, color }) {
  const colors = {
    primary: 'bg-[var(--primary)]/10 text-[var(--primary)]',
    accent:  'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    muted:   'bg-[var(--muted)] text-[var(--muted-foreground)]',
  }
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
      <div className="flex items-start justify-between mb-2 sm:mb-3 gap-1">
        <span className="text-[11px] sm:text-sm text-[var(--muted-foreground)] leading-tight">{label}</span>
        <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">{value}</p>
    </div>
  )
}

function Spinner({ sm }) {
  return (
    <svg className={`animate-spin ${sm ? 'w-3.5 h-3.5' : 'w-6 h-6'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function MobileCheckinCard({
  c, showCheckout, isSelecting, isDeleting, isCheckingOut,
  deleting, checkingOut, onToggle, onExpand, onCheckout, onCheckoutConfirm,
  onDelete, onDeleteConfirm, onCancel,
}) {
  const isActive = !c.checked_out_at
  return (
    <div
      onClick={e => { if (e.target.closest('button,input')) return; onExpand() }}
      className={`p-4 transition-colors cursor-pointer ${
        isDeleting    ? 'bg-red-50 dark:bg-red-900/10' :
        isCheckingOut ? 'bg-[var(--primary)]/5' :
        isSelecting   ? 'bg-[var(--primary)]/5' :
        'bg-[var(--card)] active:bg-[var(--muted)]/40'
      }`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelecting}
          onChange={() => onToggle(c.id)}
          onClick={e => e.stopPropagation()}
          className="mt-1 rounded border-[var(--border)] accent-[var(--primary)] cursor-pointer flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                text-xs font-bold text-[var(--primary)] flex-shrink-0">
                {c.person.first_name[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-[var(--foreground)] text-sm">
                    {c.person.first_name} {c.person.last_name}
                  </p>
                  {c.person.medical_notes && (
                    <span title={c.person.medical_notes}
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full
                        bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 cursor-help flex-shrink-0">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                  {showCheckout && (
                    isActive
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5
                          rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                          Here
                        </span>
                      : <span className="text-[10px] text-[var(--muted-foreground)]">
                          Out {fmtTime(c.checked_out_at)}
                        </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">
                  {c.service.name}{c.classGroup ? ` · ${c.classGroup.name}` : ''}
                </p>
              </div>
            </div>

            {/* Kebab / confirm buttons */}
            {isCheckingOut ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={onCheckoutConfirm} disabled={checkingOut}
                  className="px-2 py-1 rounded bg-[var(--primary)] text-[var(--primary-foreground)]
                    text-[10px] font-semibold hover:bg-[var(--primary)]/90 disabled:opacity-50">
                  {checkingOut ? '…' : 'Confirm'}
                </button>
                <button onClick={onCancel}
                  className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
                    text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
              </div>
            ) : isDeleting ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={onDeleteConfirm} disabled={deleting}
                  className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-semibold
                    hover:bg-red-700 disabled:opacity-50">
                  {deleting ? '…' : 'Remove'}
                </button>
                <button onClick={onCancel}
                  className="px-2 py-1 rounded border border-[var(--border)] text-[10px]
                    text-[var(--muted-foreground)] hover:bg-[var(--muted)]">✕</button>
              </div>
            ) : (
              <MobileCardKebab
                isActive={isActive}
                showCheckout={showCheckout}
                onExpand={onExpand}
                onCheckout={onCheckout}
                onDelete={onDelete}
              />
            )}
          </div>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
            {c.guardian_name && <span>{c.guardian_name}</span>}
            {showCheckout && c.pickup_code && (
              <span className="font-mono font-bold text-[var(--primary)] tracking-widest">
                {c.pickup_code}
              </span>
            )}
            <span>{fmtTime(c.checked_in_at)}</span>
          </div>

        </div>
      </div>
    </div>
  )
}

function MobileCardKebab({ isActive, showCheckout, onExpand, onCheckout, onDelete }) {
  const [open,    setOpen]    = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })
  const btnRef  = useRef(null)
  const dropRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function close(e) {
      if (btnRef.current?.contains(e.target)) return
      if (dropRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  function handleOpen(e) {
    e.stopPropagation()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuHeight = showCheckout && isActive ? 130 : 100
      const top = window.innerHeight - rect.bottom >= menuHeight
        ? rect.bottom + 4
        : rect.top - menuHeight - 4
      setDropPos({ top, right: window.innerWidth - rect.right })
    }
    setOpen(v => !v)
  }

  function act(fn) { setOpen(false); fn() }

  return (
    <div className="flex-shrink-0">
      <button ref={btnRef} onClick={handleOpen}
        className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)]
          hover:bg-[var(--muted)] transition-colors">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <div ref={dropRef}
          style={{ position: 'fixed', top: dropPos.top, right: dropPos.right }}
          className="z-50 w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
          <button onClick={() => act(onExpand)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--foreground)]
              hover:bg-[var(--muted)] transition-colors text-left">
            <svg className="w-4 h-4 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Details
          </button>
          {showCheckout && isActive && (
            <button onClick={() => act(onCheckout)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--primary)]
                hover:bg-[var(--primary)]/5 transition-colors text-left">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
              </svg>
              Check Out
            </button>
          )}
          <div className="border-t border-[var(--border)] my-0.5" />
          <button onClick={() => act(onDelete)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-600 dark:text-red-400
              hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function ClassSessionCard({ cls, staffList }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName]   = useState(cls.todaySession?.teacher_name  ?? '')
  const [phone, setPhone] = useState(cls.todaySession?.teacher_phone ?? '')
  const [phoneError, setPhoneError] = useState('')
  const [setSession, { loading }] = useMutation(SET_CLASS_SESSION_MUTATION, {
    refetchQueries: [{ query: TODAY_CLASS_SESSIONS_QUERY }],
    onCompleted: () => setShowForm(false),
  })
  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    if (!isValidPhone(phone)) {
      setPhoneError('Please enter a valid phone number (at least 7 digits).')
      return
    }
    setPhoneError('')
    await setSession({ variables: { classId: cls.id, teacherName: name.trim(), teacherPhone: phone.trim() || null } })
  }
  const session = cls.todaySession
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">{cls.name}</p>
          {session
            ? <div className="mt-1">
                <p className="text-sm text-[var(--foreground)]">{session.teacher_name}</p>
                {session.teacher_phone && <p className="text-xs text-[var(--muted-foreground)]">{session.teacher_phone}</p>}
              </div>
            : <p className="text-xs text-[var(--muted-foreground)] mt-1">No teacher assigned yet</p>}
        </div>
        <button
          onClick={() => { setName(session?.teacher_name ?? ''); setPhone(session?.teacher_phone ?? ''); setShowForm(v => !v) }}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)]
            text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors">
          {session ? 'Change' : 'Assign'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSave} className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
          <TeacherCombobox value={name} onChange={setName}
            onSelect={(s) => { setName(s.name); setPhone(s.phone ?? '') }} staffList={staffList} />
          <PhoneInput
            value={phone}
            onChange={val => { setPhone(val); setPhoneError('') }}
          />
          {phoneError && <p className="text-[11px] text-[var(--destructive)]">{phoneError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-1.5 rounded-lg border border-[var(--border)] text-xs
                text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex-1 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)]
                text-xs font-semibold hover:bg-[var(--primary)]/90 disabled:opacity-50 transition-colors">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function TeacherCombobox({ value, onChange, onSelect, staffList }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const filtered = value.trim().length > 0
    ? staffList.filter(u => u.name.toLowerCase().includes(value.trim().toLowerCase()))
    : staffList
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  return (
    <div ref={containerRef} className="relative">
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} placeholder="Teacher name *" required autoFocus
        className={sessionInput} autoComplete="off" />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-[var(--border)]
          bg-[var(--card)] shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map(u => (
            <button key={u.id} type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(u); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left
                hover:bg-[var(--primary)]/5 transition-colors">
              <div className="w-6 h-6 rounded-full bg-[var(--primary)]/15 flex items-center justify-center
                text-[10px] font-bold text-[var(--primary)] flex-shrink-0">{u.name[0].toUpperCase()}</div>
              <p className="text-sm font-medium text-[var(--foreground)] truncate flex-1">{u.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)]
                text-[var(--muted-foreground)] flex-shrink-0">
                {{ TEACHER: 'Teacher', ADMIN: 'Admin', VOLUNTEER: 'Volunteer' }[u.role] ?? u.role}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const sessionInput = `w-full px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm placeholder:text-[var(--muted-foreground)]
  focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50 focus:border-[var(--ring)] transition-colors`

const filterSelect = `px-3 py-2 rounded-lg border border-[var(--input)] bg-[var(--background)]
  text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/50
  focus:border-[var(--ring)] transition-colors cursor-pointer`

// ── Summary View ──────────────────────────────────────────────────────────────

const CLASS_ORDER  = ['Toddler', 'Pre School', 'Primary', 'Pre Teens']
const AGE_LABELS   = { Toddler: '0–3', 'Pre School': '4–6', Primary: '7–8', 'Pre Teens': '9–12' }

function computeSummary(rows, schedules, serviceId = null) {
  const r   = serviceId ? rows.filter(c => c.service.id === serviceId) : rows
  const sch = serviceId ? schedules.filter(s => s.service?.id === serviceId) : schedules
  const byClass = {}
  r.forEach(c => { const n = c.classGroup?.name ?? 'Unassigned'; byClass[n] = (byClass[n] || 0) + 1 })
  return {
    total:      r.length,
    stillHere:  r.filter(c => !c.checked_out_at).length,
    checkedOut: r.filter(c => c.checked_out_at).length,
    byClass,
    guardians:  new Set(r.filter(c => c.guardian_name).map(c => c.guardian_name)).size,
    volunteers: new Set(sch.map(s => s.user.id)).size,
  }
}

function SummaryCard({ title, stats, highlight = false, classMetaMap = {} }) {
  const orderedClasses = [
    ...CLASS_ORDER.filter(k => stats.byClass[k]),
    ...Object.keys(stats.byClass).filter(k => !CLASS_ORDER.includes(k) && stats.byClass[k]),
  ]
  return (
    <div className={`rounded-xl border p-4 ${highlight
      ? 'border-[var(--primary)]/30 bg-[var(--primary)]/5'
      : 'border-[var(--border)] bg-[var(--card)]'}`}>
      <h3 className={`text-sm font-bold mb-3 ${highlight ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
        {title}
      </h3>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Total Kids', value: stats.total, bold: true },
          { label: 'Still Here', value: stats.stillHere },
          { label: 'Checked Out', value: stats.checkedOut },
        ].map(({ label, value, bold }) => (
          <div key={label} className="rounded-lg bg-[var(--muted)]/60 p-2.5 text-center">
            <p className={`text-xl font-bold ${bold ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>{value}</p>
            <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* By age group */}
      {orderedClasses.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">By Age Group</p>
          <div className="space-y-1.5">
            {orderedClasses.map(name => {
              const meta = classMetaMap[name]
              return (
              <div key={name} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--foreground)] truncate">{name}</span>
                    {meta?.ageRange && (
                      <span className="text-[10px] text-[var(--muted-foreground)] flex-shrink-0">{meta.ageRange}</span>
                    )}
                  </div>
                  {meta?.description && (
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate leading-tight">{meta.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Bar */}
                  <div className="w-16 h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${stats.total ? (stats.byClass[name] / stats.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-bold text-[var(--foreground)] w-5 text-right">{stats.byClass[name]}</span>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}

      {/* Footer stats */}
      <div className="flex gap-4 pt-2.5 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
        <span>Guardians <strong className="text-[var(--foreground)]">{stats.guardians}</strong></span>
        <span>Volunteers <strong className="text-[var(--foreground)]">{stats.volunteers}</strong></span>
      </div>
    </div>
  )
}

function SummaryView({ rawList, schedules, classMetaMap = {} }) {
  if (rawList.length === 0) return (
    <div className="flex flex-col items-center justify-center h-32 text-[var(--muted-foreground)]
      border border-dashed border-[var(--border)] rounded-xl text-sm">
      No check-ins recorded today yet
    </div>
  )

  const dayStats = computeSummary(rawList, schedules)
  const servicesInData = Array.from(new Map(rawList.map(c => [c.service.id, c.service])).values())
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-4">
      {/* Whole Day */}
      <SummaryCard title="Whole Day — All Services" stats={dayStats} highlight classMetaMap={classMetaMap} />

      {/* Per Service */}
      {servicesInData.length > 1 && (
        <>
          <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider pt-1">Per Service</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {servicesInData.map(svc => (
              <SummaryCard
                key={svc.id}
                title={svc.name}
                stats={computeSummary(rawList, schedules, svc.id)}
                classMetaMap={classMetaMap}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
