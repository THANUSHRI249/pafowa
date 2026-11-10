import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Megaphone,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { repo } from '../../lib/data'
import {
  findConfirmedPayment,
  findPaymentForUnit,
  receiptFallback,
  residentBillingUnits,
} from '../../lib/billing'
import { currentMonthKey, formatDate, money, monthLabel, monthKeyOf } from '../../lib/utils'
import { downloadReceiptPdf } from '../../lib/pdf'
import Card, { CardHeader } from '../../components/ui/Card'
import { buttonClasses } from '../../components/ui/Button'
import Button from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { InlineError, PageSkeleton, Avatar } from '../../components/ui/Misc'
import EmptyState from '../../components/ui/EmptyState'
import AnnouncementCard from '../../components/AnnouncementCard'
import PaymentDetailModal from '../../components/PaymentDetailModal'
import { cn } from '../../lib/utils'

const CURRENT_MONTH = currentMonthKey()

const STATUS_COPY = {
  unpaid: { label: 'Not paid yet', Icon: AlertTriangle },
  pending: { label: 'Awaiting treasurer confirmation', Icon: Clock },
  confirmed: { label: 'Payment confirmed', Icon: CheckCircle2 },
  rejected: { label: 'Needs your attention', Icon: AlertTriangle },
}

export default function ResidentHome() {
  const { user } = useAuth()
  const toast = useToast()
  const [unitKey, setUnitKey] = useState('')
  const [detailPayment, setDetailPayment] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [apartments, combined, announcements, payments] = await Promise.all([
      repo.apartments.mine(user.id),
      repo.combined.list(),
      repo.announcements.list(),
      repo.payments.list({}),
    ])
    return {
      units: residentBillingUnits(apartments, combined, user.id),
      announcements,
      payments,
    }
  }, [user.id])

  if (loading && !data) return <PageSkeleton />
  if (error && !data) return <InlineError message={error.message} onRetry={reload} />

  const units = data?.units || []
  const payments = data?.payments || []
  const announcements = (data?.announcements || []).slice(0, 2)
  const unit = units.find((item) => item.key === unitKey) || units[0] || null
  const month = CURRENT_MONTH
  const current = unit ? findPaymentForUnit(payments, unit.key, month) : { status: 'unpaid', payment: null }
  const lastConfirmed = unit ? findConfirmedPayment(payments, unit.key) : null
  const firstName = String(user?.full_name || 'Resident').split(' ')[0]
  const statusCopy = STATUS_COPY[current.status] || STATUS_COPY.unpaid

  const heroAmount =
    current.status === 'confirmed' || current.status === 'pending'
      ? current.payment?.amount_paid
      : unit?.maintenance_amount

  const download = async (payment) => {
    if (!payment || downloading) return
    setDownloading(true)
    try {
      const receipt = await repo.receipts.getByPayment(payment.id).catch(() => null)
      await downloadReceiptPdf(receipt || receiptFallback(payment))
    } catch {
      toast.error('Could not create the receipt PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[1.1rem] font-semibold text-slate-500">Welcome back</p>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-slate-900 sm:text-[2rem]">
            Namaste, {firstName}
          </h1>
        </div>
        <Avatar name={user?.full_name} size="lg" className="hidden sm:inline-flex" />
      </div>

      {units.length > 1 ? (
        <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {units.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setUnitKey(item.key)}
              className={cn(
                'min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition',
                item.key === unit.key
                  ? 'border-transparent bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {!unit ? (
        <Card className="border-dashed">
          <EmptyState
            icon={Building2}
            title="Your apartment is not linked yet"
            description="Ask the treasurer to link your apartment to this account. Once linked, you will see your maintenance, receipts and payment history here."
            action={
              <Link to="/profile" className={buttonClasses({ variant: 'soft', size: 'md' })}>
                Open profile
              </Link>
            }
          />
          <div className="rounded-2xl bg-brand-50/70 p-4 text-[0.9rem] leading-relaxed text-brand-800">
            <p className="font-semibold">Signed in as {user?.email}</p>
            <p className="mt-1">The treasurer uses this email to connect your apartment.</p>
          </div>
        </Card>
      ) : (
        <section className="relative overflow-hidden rounded-[1.9rem] gpay-gradient p-5 text-white shadow-float sm:p-7">
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 -left-8 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.92rem] text-white/80">Maintenance · {monthLabel(month)}</p>
                <p className="mt-0.5 text-sm text-white/70">Apartment {unit.label}</p>
              </div>
              <StatusBadge
                status={current.status}
                long
                className="!bg-white/90 !text-slate-800 !ring-white/30"
              />
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium text-white/75">
                {current.status === 'confirmed' || current.status === 'pending' ? 'Amount paid' : 'Amount due'}
              </p>
              <p className="mt-1 text-[2.4rem] font-extrabold leading-none tracking-tight sm:text-[2.8rem]">
                {money(heroAmount)}
              </p>
              <p className="mt-2.5 flex items-center gap-1.5 text-[0.92rem] text-white/85">
                <statusCopy.Icon className="h-4 w-4" />
                {current.status === 'confirmed' && current.payment?.receipt_number
                  ? `Receipt ${current.payment.receipt_number}`
                  : statusCopy.label}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {current.status === 'unpaid' || current.status === 'rejected' ? (
                <>
                  <Link
                    to="/maintenance"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-[0.98rem] font-bold text-brand-700 shadow-sm transition hover:bg-brand-50"
                  >
                    <Wallet className="h-5 w-5" />
                    {current.status === 'rejected' ? 'Submit again' : 'Pay maintenance'}
                  </Link>
                  {current.status === 'rejected' ? (
                    <button
                      type="button"
                      onClick={() => setDetailPayment(current.payment)}
                      className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 px-5 text-[0.95rem] font-semibold text-white transition hover:bg-white/10"
                    >
                      See reason
                    </button>
                  ) : (
                    <Link
                      to="/history"
                      className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 px-5 text-[0.95rem] font-semibold text-white transition hover:bg-white/10"
                    >
                      View history
                    </Link>
                  )}
                </>
              ) : null}

              {current.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDetailPayment(current.payment)}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-[0.98rem] font-bold text-brand-700 shadow-sm transition hover:bg-brand-50"
                  >
                    <ReceiptText className="h-5 w-5" />
                    View payment
                  </button>
                  <Link
                    to="/maintenance"
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 px-5 text-[0.95rem] font-semibold text-white transition hover:bg-white/10"
                  >
                    Payment details
                  </Link>
                </>
              ) : null}

              {current.status === 'confirmed' ? (
                <>
                  <Button
                    variant="secondary"
                    className="!bg-white !text-brand-700 !border-transparent"
                    icon={Download}
                    loading={downloading}
                    onClick={() => download(current.payment)}
                  >
                    Download receipt
                  </Button>
                  <Link
                    to="/maintenance"
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 px-5 text-[0.95rem] font-semibold text-white transition hover:bg-white/10"
                  >
                    Payment details
                  </Link>
                </>
              ) : null}
            </div>

            {current.status === 'confirmed' && current.payment ? (
              <p className="mt-4 text-[0.88rem] text-white/75">
                Paid on {formatDate(current.payment.payment_date)} ·{' '}
                {current.payment.payment_method === 'bank' ? 'Bank / UPI' : 'Cash'}
              </p>
            ) : null}
            {current.status === 'rejected' && current.payment?.rejection_reason ? (
              <p className="mt-4 rounded-xl bg-white/15 px-3 py-2 text-[0.88rem] leading-snug text-white">
                {current.payment.rejection_reason}
              </p>
            ) : null}
          </div>
        </section>
      )}

      {unit ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader
              icon={ReceiptText}
              title="Last payment"
              action={
                <Link to="/history" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                  View all
                </Link>
              }
            />
            {lastConfirmed ? (
              <div>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-[1.55rem] font-bold leading-none text-slate-900">
                    {money(lastConfirmed.amount_paid)}
                  </p>
                  <StatusBadge status="confirmed" />
                </div>
                <p className="mt-2 text-[0.95rem] font-medium text-slate-700">
                  {monthLabel(monthKeyOf(lastConfirmed.maintenance_month))}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  Paid {formatDate(lastConfirmed.payment_date)} ·{' '}
                  {lastConfirmed.payment_method === 'bank' ? 'Bank / UPI' : 'Cash'}
                </p>
                <button
                  type="button"
                  onClick={() => download(lastConfirmed)}
                  disabled={downloading}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  <Download className="h-4 w-4" />
                  Download receipt
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-[0.92rem] text-slate-500">
                <FileText className="h-5 w-5 text-slate-400" />
                No confirmed payments yet. Your first receipt will appear here.
              </div>
            )}
          </Card>

          <Card>
            <CardHeader icon={Building2} title="Your apartment" />
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-[1.05rem] font-bold text-brand-700">
                {unit.label}
              </span>
              <div>
                <p className="text-[0.98rem] font-semibold text-slate-900">{unit.resident_names}</p>
                <p className="text-sm text-slate-500">
                  Monthly maintenance {money(unit.maintenance_amount)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2.5 text-[0.85rem] font-medium text-emerald-800">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Only you and the treasurer can view these records
            </div>
            {units.length > 1 ? (
              <p className="mt-3 text-sm text-slate-500">
                You have {units.length} billing units linked to this account.
              </p>
            ) : null}
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader
          icon={Megaphone}
          title="Recent announcements"
          action={
            <Link to="/notices" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              View all
            </Link>
          }
        />
        {announcements.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-4 text-[0.92rem] text-slate-500">
            No announcements right now. Updates from the committee will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <AnnouncementCard key={announcement.id} announcement={announcement} compact />
            ))}
          </div>
        )}
      </Card>

      {!loading && !unit ? (
        <p className="text-center text-sm text-slate-500">
          Need help? Please contact the PAFOWA treasurer.
        </p>
      ) : null}

      <PaymentDetailModal
        payment={detailPayment}
        open={Boolean(detailPayment)}
        onClose={() => setDetailPayment(null)}
      />
    </div>
  )
}
