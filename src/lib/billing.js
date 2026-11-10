import { monthKeyOf, toNumber } from './utils'

function apartmentUnit(apt) {
  return {
    key: `apartment:${apt.id}`,
    type: 'apartment',
    id: apt.id,
    label: apt.display_label || [apt.block, apt.unit_number].filter(Boolean).join(''),
    block: apt.block,
    maintenance_amount: toNumber(apt.maintenance_amount),
    resident_names: apt.resident_name || '—',
    contact_phone: apt.contact_phone || '',
    apartment_ids: [apt.id],
    members: [apt],
    is_combined: false,
  }
}

function combinedUnit(group, members) {
  const fallbackAmount = members.reduce((sum, a) => sum + toNumber(a.maintenance_amount), 0)
  return {
    key: `combined:${group.id}`,
    type: 'combined',
    id: group.id,
    label: group.name || members.map((a) => apartmentUnit(a).label).join(' + '),
    block: members[0]?.block,
    maintenance_amount: group.maintenance_amount == null ? fallbackAmount : toNumber(group.maintenance_amount),
    resident_names:
      members
        .map((a) => a.resident_name)
        .filter(Boolean)
        .join(' / ') || '—',
    contact_phone: members[0]?.contact_phone || '',
    apartment_ids: members.map((a) => a.id),
    members,
    is_combined: true,
  }
}

/**
 * A billing unit is either one apartment or one active combined unit.
 * Combined apartments are removed from the individual list so maintenance is
 * never calculated twice.
 */
export function buildBillingUnits(apartments = [], combinedGroups = []) {
  const aptById = new Map(apartments.map((a) => [a.id, a]))
  const groupedApartmentIds = new Set()
  const units = []

  combinedGroups
    .filter((g) => g.is_active)
    .forEach((group) => {
      const members = (group.apartment_ids || []).map((id) => aptById.get(id)).filter(Boolean)
      if (members.length < 2) return
      members.forEach((m) => groupedApartmentIds.add(m.id))
      units.push(combinedUnit(group, members))
    })

  apartments
    .filter((a) => a.is_active && !groupedApartmentIds.has(a.id))
    .forEach((apt) => units.push(apartmentUnit(apt)))

  return units.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }))
}

export function unitsForResident(units, userId) {
  if (!userId) return []
  return units.filter((unit) => unit.members.some((m) => m.user_id === userId))
}

/**
 * Residents can only read their own apartment rows, so build their billing
 * units from those rows plus the combined-unit membership.
 */
export function residentBillingUnits(myApartments = [], combinedGroups = [], userId) {
  const units = []
  const seenGroups = new Set()
  myApartments.forEach((apt) => {
    const group = combinedGroups.find(
      (g) => g.is_active && (g.apartment_ids || []).includes(apt.id) && !seenGroups.has(g.id),
    )
    if (group) {
      seenGroups.add(group.id)
      const ownMembers = (group.apartment_ids || [])
        .map((id) => myApartments.find((a) => a.id === id))
        .filter(Boolean)
      const members = ownMembers.length ? ownMembers : [apt]
      const unit = combinedUnit(group, members)
      unit.members = members
      unit.resident_names =
        members
          .map((m) => m.resident_name)
          .filter(Boolean)
          .join(' / ') || apt.resident_name || '—'
      unit.contact_phone = apt.contact_phone || ''
      units.push(unit)
    } else {
      units.push(apartmentUnit(apt))
    }
  })
  const unique = new Map(units.map((unit) => [unit.key, unit]))
  return [...unique.values()].sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, { numeric: true }),
  )
}

export function unitOwnedBy(unit, userId) {
  return Boolean(unit && userId && unit.members.some((m) => m.user_id === userId))
}

/** Shared snapshot builder so payment rows are consistent in both data modes. */
export function paymentInsertFromPayload(profile, payload) {
  const { unit, month } = payload
  const bank = payload.method === 'bank'
  return {
    apartment_id: unit.type === 'apartment' ? unit.id : null,
    combined_id: unit.type === 'combined' ? unit.id : null,
    unit_label: unit.label,
    resident_name: unit.resident_names,
    maintenance_month: `${month}-01`,
    amount_due: toNumber(unit.maintenance_amount),
    amount_paid: toNumber(payload.amount),
    payment_date: payload.paymentDate,
    payment_method: payload.method,
    transaction_id: bank ? String(payload.transactionId || '').trim() || null : null,
    upi_id: bank ? String(payload.upiId || '').trim() || null : null,
    status: 'pending',
    notes: String(payload.notes || '').trim() || null,
    receipt_number: null,
    submitted_by: profile.id,
    confirmed_by: null,
    confirmed_at: null,
  }
}

export function unitKeyOfPayment(payment) {
  if (!payment) return null
  if (payment.combined_id) return `combined:${payment.combined_id}`
  if (payment.apartment_id) return `apartment:${payment.apartment_id}`
  return null
}

function statusRank(status) {
  if (status === 'confirmed') return 3
  if (status === 'pending') return 2
  if (status === 'rejected') return 1
  return 0
}

/** Returns the effective payment for a unit and month. Confirmed wins over pending. */
export function findPaymentForUnit(payments = [], unitKey, monthKey) {
  const rows = payments
    .filter((p) => unitKeyOfPayment(p) === unitKey && monthKeyOf(p.maintenance_month) === monthKey)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  if (rows.length === 0) return { payment: null, status: 'unpaid', history: [] }
  const ranked = [...rows].sort((a, b) => statusRank(b.status) - statusRank(a.status))
  return { payment: ranked[0], status: ranked[0].status, history: rows }
}

export function findConfirmedPayment(payments = [], unitKey) {
  return payments
    .filter((p) => unitKeyOfPayment(p) === unitKey && p.status === 'confirmed')
    .sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)))[0] || null
}

export function summarizeMonth({ units = [], payments = [], month, expenses = [] }) {
  const monthPayments = payments.filter((p) => monthKeyOf(p.maintenance_month) === month)
  const confirmed = monthPayments.filter((p) => p.status === 'confirmed')
  const pending = monthPayments.filter((p) => p.status === 'pending')

  const sum = (rows) => rows.reduce((total, row) => total + toNumber(row.amount_paid), 0)
  const totalCollection = sum(confirmed)
  const cashCollection = sum(confirmed.filter((p) => p.payment_method === 'cash'))
  const bankCollection = sum(confirmed.filter((p) => p.payment_method === 'bank'))
  const pendingAmount = sum(pending)

  const unitStatuses = units.map((unit) => {
    const match = findPaymentForUnit(payments, unit.key, month)
    return { unit, ...match }
  })

  const paidUnits = unitStatuses.filter((u) => u.status === 'confirmed')
  const pendingUnits = unitStatuses.filter((u) => u.status === 'pending')
  const unpaidUnits = unitStatuses.filter((u) => u.status === 'unpaid' || u.status === 'rejected')
  const expected = units.reduce((total, u) => total + toNumber(u.maintenance_amount), 0)
  const monthExpenses = expenses.filter((e) => String(e.expense_date).slice(0, 7) === month && !e.is_void)
  const expenseTotal = monthExpenses.reduce((total, e) => total + toNumber(e.amount), 0)

  return {
    monthPayments,
    confirmed,
    pending,
    totalCollection,
    cashCollection,
    bankCollection,
    pendingAmount,
    pendingCount: pending.length,
    expected,
    expenseTotal,
    netBalance: totalCollection - expenseTotal,
    paidUnits,
    pendingUnits,
    unpaidUnits,
    unitStatuses,
    collectionRate: expected > 0 ? Math.min(1, totalCollection / expected) : 0,
    monthExpenses,
  }
}

export function monthSeries(payments = [], months = []) {
  return months
    .map((month) => {
      const rows = payments.filter(
        (p) => p.status === 'confirmed' && monthKeyOf(p.maintenance_month) === month,
      )
      const total = rows.reduce((sum, p) => sum + toNumber(p.amount_paid), 0)
      const cash = rows
        .filter((p) => p.payment_method === 'cash')
        .reduce((sum, p) => sum + toNumber(p.amount_paid), 0)
      return { month, total, cash, bank: total - cash }
    })
    .reverse()
}

export function categoryTotals(expenses = []) {
  const totals = new Map()
  expenses.forEach((e) => {
    if (e.is_void) return
    const key = e.category || 'Other'
    totals.set(key, (totals.get(key) || 0) + toNumber(e.amount))
  })
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([category, total]) => ({ category, total }))
}

export function receiptFallback(payment) {
  if (!payment) return null
  return {
    receipt_number: payment.receipt_number || '—',
    resident_name: payment.resident_name,
    unit_label: payment.unit_label,
    maintenance_month: payment.maintenance_month,
    payment_date: payment.payment_date,
    amount: payment.amount_paid,
    payment_method: payment.payment_method,
    transaction_id: payment.transaction_id,
    upi_id: payment.upi_id,
    status: payment.status,
    issued_at: payment.confirmed_at || payment.updated_at || payment.created_at,
  }
}
