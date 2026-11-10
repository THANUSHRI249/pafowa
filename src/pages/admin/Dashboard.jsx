import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Banknote,
  Building2,
  ChevronRight,
  Clock,
  Landmark,
  Megaphone,
  ReceiptText,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { repo } from '../../lib/data'
import { buildBillingUnits, monthSeries, summarizeMonth } from '../../lib/billing'
import {
  currentMonthKey,
  formatDate,
  money,
  monthLabel,
  monthOptions,
  monthShort,
} from '../../lib/utils'
import Card, { CardHeader } from '../../components/ui/Card'
import StatCard from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/Badge'
import Button, { buttonClasses } from '../../components/ui/Button'
import { InlineError, MonthSelect, PageHeader, PageSkeleton } from '../../components/ui/Misc'
import PaymentDetailModal from '../../components/PaymentDetailModal'
import EmptyState from '../../components/ui/EmptyState'

const compactMoney = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const STATUS_ORDER = { pending: 0, unpaid: 1, rejected: 1, confirmed: 2 }

export default function TreasurerDashboard() {
  const { user, isTreasurer } = useAuth()
  const [month, setMonth] = useState(currentMonthKey())
  const [selectedPayment, setSelectedPayment] = useState(null)

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [apartments, combined, payments, expenses] = await Promise.all([
      repo.apartments.list({}),
      repo.combined.list(),
      repo.payments.list({}),
      repo.expenses.list({}),
    ])
    return {
      units: buildBillingUnits(apartments, combined),
      payments,
      expenses,
    }
  }, [])

  const summary = useMemo(() => {
    if (!data) return null
    return summarizeMonth({
      units: data.units,
      payments: data.payments,
      expenses: data.expenses,
      month,
    })
  }, [data, month])

  const series = useMemo(
    () => (data ? monthSeries(data.payments, monthOptions(6)) : []),
    [data],
  )

  if (loading && !data) return <PageSkeleton />
  if (error && !data) return <InlineError message={error.message} onRetry={reload} />
  if (!summary) return null

  const firstName = String(user?.full_name || '').split(' ')[0]
  const recentPayments = [...summary.monthPayments]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 5)
  const recentExpenses = [...summary.monthExpenses]
    .sort((a, b) => String(b.expense_date).localeCompare(String(a.expense_date)))
    .slice(0, 4)
  const outstanding = Math.max(0, summary.expected - summary.totalCollection)
  const totalUnits = data.units.length
  const statusList = [...summary.unitStatuses].sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) ||
      String(a.unit.label).localeCompare(String(b.unit.label), undefined, { numeric: true }),
  )
  const maxSeries = Math.max(1, ...series.map((point) => point.total))

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={formatDate(new Date())}
        title={`Namaste, ${firstName}`}
        description="Collections and spending for the association, updated from live records."
        action={
          <div className="w-full sm:w-64">
            <MonthSelect value={month} onChange={setMonth} label="Viewing month" />
          </div>
        }
      />

      {summary.pendingCount > 0 ? (
        <Link
          to="/admin/collections"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 transition hover:bg-amber-100/60"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Clock className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.98rem] font-semibold text-amber-900">
              {summary.pendingCount}{' '}
              {summary.pendingCount === 1 ? 'payment is' : 'payments are'}{' '}
              {isTreasurer ? 'waiting for your confirmation' : 'waiting for treasurer confirmation'}
            </p>
            <p className="text-sm text-amber-800">
              {money(summary.pendingAmount)} waiting for verification
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-amber-700" />
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total collection"
          value={money(summary.totalCollection)}
          icon={Wallet}
          tone="brand"
          sub={`Confirmed · ${monthLabel(month)}`}
        />
        <StatCard
          label="Cash collection"
          value={money(summary.cashCollection)}
          icon={Banknote}
          tone="emerald"
          sub="Handed to treasurer"
        />
        <StatCard
          label="Bank collection"
          value={money(summary.bankCollection)}
          icon={Landmark}
          tone="grape"
          sub="Transfers & UPI"
        />
        <StatCard
          label="Pending payments"
          value={money(summary.pendingAmount)}
          icon={Clock}
          tone="amber"
          sub={`${summary.pendingCount} awaiting confirmation`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[1.08rem] font-semibold text-slate-900">Collection progress</h2>
              <p className="mt-0.5 text-sm text-slate-500">{monthLabel(month)}</p>
            </div>
            <span className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700">
              {Math.round(summary.collectionRate * 100)}%
            </span>
          </div>
          <div
            className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(summary.collectionRate * 100)}
            aria-label="Collection progress"
          >
            <div
              className="h-full rounded-full gpay-gradient transition-[width] duration-500"
              style={{ width: `${Math.max(2, summary.collectionRate * 100)}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[0.72rem] font-medium uppercase tracking-wide text-slate-500">Expected</p>
              <p className="mt-1 text-[0.98rem] font-bold text-slate-900">{money(summary.expected)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5">
              <p className="text-[0.72rem] font-medium uppercase tracking-wide text-emerald-700">Collected</p>
              <p className="mt-1 text-[0.98rem] font-bold text-emerald-800">
                {money(summary.totalCollection)}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5">
              <p className="text-[0.72rem] font-medium uppercase tracking-wide text-amber-700">Outstanding</p>
              <p className="mt-1 text-[0.98rem] font-bold text-amber-800">{money(outstanding)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {summary.paidUnits.length} of {totalUnits} billing units paid ·{' '}
            {summary.pendingUnits.length} pending · {summary.unpaidUnits.length} not paid
          </p>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[1.08rem] font-semibold text-slate-900">This month</h2>
              <p className="mt-0.5 text-sm text-slate-500">Collecting versus spending</p>
            </div>
            <TrendingUp className="h-6 w-6 text-brand-500" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3.5">
              <p className="text-sm text-slate-500">Collected</p>
              <p className="mt-1 text-[1.25rem] font-bold text-slate-900">
                {money(summary.totalCollection)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3.5">
              <p className="text-sm text-slate-500">Expenses</p>
              <p className="mt-1 text-[1.25rem] font-bold text-slate-900">{money(summary.expenseTotal)}</p>
            </div>
          </div>
          <div
            className={
              summary.netBalance >= 0
                ? 'mt-3 rounded-2xl bg-emerald-50 p-3.5'
                : 'mt-3 rounded-2xl bg-rose-50 p-3.5'
            }
          >
            <p className="text-sm font-medium text-slate-600">Net balance this month</p>
            <p
              className={
                summary.netBalance >= 0
                  ? 'mt-1 text-[1.4rem] font-bold text-emerald-700'
                  : 'mt-1 text-[1.4rem] font-bold text-rose-700'
              }
            >
              {money(summary.netBalance)}
            </p>
          </div>
          <Link
            to="/admin/expenses"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
          >
            {isTreasurer ? 'Manage expenses' : 'Review expenses'}{' '}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={ReceiptText}
            title="Recent transactions"
            description={monthLabel(month)}
            action={
              <Link to="/history" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                View all
              </Link>
            }
          />
          {recentPayments.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-[0.92rem] text-slate-500">
              No payments recorded for this month yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentPayments.map((payment) => (
                <button
                  key={payment.id}
                  type="button"
                  onClick={() => setSelectedPayment(payment)}
                  className="flex w-full items-center gap-3 py-3 text-left transition first:pt-0 last:pb-0 hover:opacity-80"
                >
                  <span
                    className={
                      payment.payment_method === 'bank'
                        ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-grape-50 text-grape-600'
                        : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600'
                    }
                  >
                    {payment.payment_method === 'bank' ? (
                      <Landmark className="h-5 w-5" />
                    ) : (
                      <Banknote className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] font-semibold text-slate-900">
                      {payment.unit_label}
                      <span className="ml-2 text-xs font-medium text-slate-500">{payment.resident_name}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(payment.payment_date)} · {monthShort(month)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[0.95rem] font-bold text-slate-900">{money(payment.amount_paid)}</p>
                    <StatusBadge status={payment.status} size="sm" className="mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            icon={Wallet}
            title="Recent expenses"
            description={`Total ${money(summary.expenseTotal)} this month`}
            action={
              <Link
                to="/admin/expenses"
                className="text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                View all
              </Link>
            }
          />
          {recentExpenses.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-[0.92rem] text-slate-500">
              No expenses recorded for this month.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                    {String(expense.category || 'O').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] font-semibold text-slate-900">
                      {expense.description}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(expense.expense_date)} · {expense.paid_to}
                    </p>
                  </div>
                  <p className="text-[0.95rem] font-bold text-slate-900">{money(expense.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={TrendingUp}
          title="Monthly collection summary"
          description="Confirmed maintenance collected over the last six months"
        />
        <div className="mt-2 flex h-44 items-end gap-2 sm:gap-4">
          {series.map((point) => {
            const height = point.total > 0 ? Math.max(4, Math.round((point.total / maxSeries) * 100)) : 2
            const cashShare = point.total > 0 ? (point.cash / point.total) * 100 : 0
            return (
              <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-[0.68rem] font-semibold text-slate-500">
                  {point.total > 0 ? compactMoney.format(point.total) : '—'}
                </span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="relative w-full max-w-12 overflow-hidden rounded-t-lg bg-brand-500/90 transition-all"
                    style={{ height: `${height}%` }}
                    title={`${monthLabel(point.month)}: ${money(point.total)} (Cash ${money(point.cash)}, Bank ${money(point.bank)})`}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 bg-emerald-400"
                      style={{ height: `${cashShare}%` }}
                    />
                  </div>
                </div>
                <span className="text-[0.72rem] font-medium text-slate-500">{monthShort(point.month)}</span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Cash
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Bank / UPI
          </span>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={Building2}
          title="Apartment payment status"
          description={`${totalUnits} billing units · ${monthLabel(month)}`}
          action={
            <Link
              to="/admin/apartments"
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              Directory
            </Link>
          }
        />
        {totalUnits === 0 ? (
          <EmptyState
            icon={Building2}
            title="No apartments yet"
            description={
              isTreasurer
                ? 'Add apartments or blocks to start tracking maintenance.'
                : 'The treasurer has not added any apartments yet.'
            }
            action={
              isTreasurer ? (
                <Link to="/admin/apartments" className={buttonClasses({ size: 'md' })}>
                  Add apartments
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                {summary.paidUnits.length} paid
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                {summary.pendingUnits.length} pending
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {summary.unpaidUnits.length} not paid
              </span>
            </div>
            <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {statusList.map(({ unit, status, payment }) => (
                <button
                  key={unit.key}
                  type="button"
                  onClick={() => payment && setSelectedPayment(payment)}
                  disabled={!payment}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3.5 text-left transition enabled:hover:border-brand-100 enabled:hover:bg-brand-50/20"
                >
                  <div className="min-w-0">
                    <p className="text-[0.95rem] font-semibold text-slate-900">
                      {unit.label}
                      {unit.is_combined ? (
                        <span className="ml-2 rounded-full bg-grape-50 px-2 py-0.5 text-[0.65rem] font-semibold text-grape-600">
                          Combined
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-slate-500">{unit.resident_names}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={status} size="sm" />
                    <span className="text-xs font-medium text-slate-500">
                      {money(payment ? payment.amount_paid : unit.maintenance_amount)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/admin/collections"
          className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-soft transition hover:border-brand-100"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Wallet className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[1rem] font-semibold text-slate-900">Maintenance collections</span>
            <span className="block text-sm text-slate-500">
              {isTreasurer ? 'Confirm payments and record receipts' : 'Review payments and receipts'}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </Link>
        <Link
          to="/notices"
          className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-soft transition hover:border-brand-100"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-grape-50 text-grape-600">
            <Megaphone className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-[1rem] font-semibold text-slate-900">Announcements</span>
            <span className="block text-sm text-slate-500">
              {isTreasurer ? 'Publish updates for residents' : 'Read association updates'}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </Link>
      </div>

      <PaymentDetailModal
        payment={selectedPayment}
        open={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  )
}
