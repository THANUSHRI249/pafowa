export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

const inr0 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const inr2 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function money(value, { exact = false } = {}) {
  const n = Number(value || 0)
  return (exact ? inr2 : inr0).format(Number.isFinite(n) ? n : 0)
}

export function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function todayISO() {
  return toISODate(new Date())
}

export function toISODate(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentMonthKey() {
  return todayISO().slice(0, 7)
}

export function monthKeyOf(isoDate) {
  return String(isoDate || '').slice(0, 7)
}

export function monthLabel(monthKey) {
  if (!monthKey) return '—'
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return '—'
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}

export function monthShort(monthKey) {
  if (!monthKey) return '—'
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return '—'
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export function addMonths(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthOptions(count = 18, from = currentMonthKey()) {
  return Array.from({ length: count }, (_, i) => addMonths(from, -i))
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}

export function relativeDay(value) {
  if (!value) return ''
  const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value)
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((start - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return `${diff} days ago`
  return formatDate(value)
}

export function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function unitLabelForApartment(apt) {
  if (!apt) return '—'
  return apt.display_label || [apt.block, apt.unit_number].filter(Boolean).join('')
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function sortByDateDesc(rows, key = 'created_at') {
  return [...rows].sort((a, b) => String(b[key] ?? '').localeCompare(String(a[key] ?? '')))
}
