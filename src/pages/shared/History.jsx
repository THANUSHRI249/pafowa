import { useMemo, useState } from 'react'
import { Banknote, ChevronRight, Landmark, Search, SlidersHorizontal, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { repo } from '../../lib/data'
import { unitKeyOfPayment } from '../../lib/billing'
import {
  formatDate,
  money,
  monthLabel,
  monthKeyOf,
  monthOptions,
} from '../../lib/utils'
import Card from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/Input'
import { InlineError, PageHeader, PageSkeleton } from '../../components/ui/Misc'
import EmptyState from '../../components/ui/EmptyState'
import PaymentDetailModal from '../../components/PaymentDetailModal'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'confirmed', label: 'Paid / confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
]

const METHOD_OPTIONS = [
  { value: 'all', label: 'All methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank / UPI' },
]

export default function PaymentHistory() {
  const { user, isOfficer } = useAuth()
  const [filters, setFilters] = useState({
    month: 'all',
    status: 'all',
    method: 'all',
    unitKey: 'all',
    search: '',
  })
  const [selected, setSelected] = useState(null)

  const { data, loading, error, reload } = useAsyncData(
    () => repo.payments.list({}),
    [user.id],
  )

  const payments = data || []

  const monthFilterOptions = useMemo(() => {
    const months = new Set(payments.map((p) => monthKeyOf(p.maintenance_month)))
    monthOptions(12).forEach((month) => months.add(month))
    return [
      { value: 'all', label: 'All months' },
      ...[...months]
        .sort()
        .reverse()
        .map((month) => ({ value: month, label: monthLabel(month) })),
    ]
  }, [payments])

  const unitFilterOptions = useMemo(() => {
    const map = new Map()
    payments.forEach((payment) => {
      const key = unitKeyOfPayment(payment)
      if (key && !map.has(key)) map.set(key, payment.unit_label || 'Unit')
    })
    return [
      { value: 'all', label: 'All apartments' },
      ...[...map.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    ]
  }, [payments])

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    return payments.filter((payment) => {
      if (filters.month !== 'all' && monthKeyOf(payment.maintenance_month) !== filters.month) return false
      if (filters.status !== 'all' && payment.status !== filters.status) return false
      if (filters.method !== 'all' && payment.payment_method !== filters.method) return false
      if (filters.unitKey !== 'all' && unitKeyOfPayment(payment) !== filters.unitKey) return false
      if (!query) return true
      return [
        payment.unit_label,
        payment.resident_name,
        payment.receipt_number,
        payment.transaction_id,
        payment.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [payments, filters])

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const hasFilters =
    filters.month !== 'all' ||
    filters.status !== 'all' ||
    filters.method !== 'all' ||
    filters.unitKey !== 'all' ||
    Boolean(filters.search)

  const reset = () =>
    setFilters({ month: 'all', status: 'all', method: 'all', unitKey: 'all', search: '' })

  if (loading && !data) return <PageSkeleton />
  if (error && !data) return <InlineError message={error.message} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Payment history"
        description={
          isOfficer
            ? 'Search every maintenance payment across the association.'
            : 'Every maintenance payment for your apartment, with downloadable receipts.'
        }
      />

      <Card className="mb-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            placeholder="Search apartment, receipt number or UTR"
            aria-label="Search payments"
            className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[1rem] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            name="filterMonth"
            label="Month"
            value={filters.month}
            onChange={(event) => setFilter('month', event.target.value)}
            options={monthFilterOptions}
          />
          <Select
            name="filterStatus"
            label="Status"
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
            options={STATUS_OPTIONS}
          />
          <Select
            name="filterMethod"
            label="Method"
            value={filters.method}
            onChange={(event) => setFilter('method', event.target.value)}
            options={METHOD_OPTIONS}
          />
          {unitFilterOptions.length > 2 ? (
            <Select
              name="filterUnit"
              label="Apartment"
              value={filters.unitKey}
              onChange={(event) => setFilter('unitKey', event.target.value)}
              options={unitFilterOptions}
            />
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <SlidersHorizontal className="h-4 w-4" />
            {filtered.length} {filtered.length === 1 ? 'payment' : 'payments'}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50"
            >
              <X className="h-4 w-4" /> Clear filters
            </button>
          ) : null}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title={payments.length === 0 ? 'No payments yet' : 'No payments match these filters'}
            description={
              payments.length === 0
                ? isOfficer
                  ? 'Recorded maintenance payments will appear here.'
                  : 'Your payments will appear here once you submit your first maintenance payment.'
                : 'Try a different month, status or search term.'
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={reset}
                  className="min-h-11 rounded-full bg-brand-50 px-5 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((payment) => {
            const Icon = payment.payment_method === 'bank' ? Landmark : Banknote
            return (
              <button
                key={payment.id}
                type="button"
                onClick={() => setSelected(payment)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-soft transition hover:border-brand-100 hover:bg-brand-50/20 sm:gap-4 sm:p-5"
              >
                <span
                  className={
                    payment.payment_method === 'bank'
                      ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grape-50 text-grape-600'
                      : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600'
                  }
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[1rem] font-semibold text-slate-900">
                    {payment.unit_label}
                    <span className="text-[0.85rem] font-medium text-slate-500">
                      {monthLabel(monthKeyOf(payment.maintenance_month))}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[0.85rem] text-slate-500">
                    {isOfficer ? `${payment.resident_name} · ` : ''}
                    {formatDate(payment.payment_date)} ·{' '}
                    {payment.payment_method === 'bank' ? 'Bank / UPI' : 'Cash'}
                    {payment.receipt_number ? ` · ${payment.receipt_number}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="text-[1.05rem] font-bold tabular-nums text-slate-900">
                    {money(payment.amount_paid)}
                  </p>
                  <StatusBadge status={payment.status} size="sm" />
                </div>
                <ChevronRight className="hidden h-5 w-5 shrink-0 text-slate-300 sm:block" />
              </button>
            )
          })}
        </div>
      )}

      <PaymentDetailModal
        payment={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
