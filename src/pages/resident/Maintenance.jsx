import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Info,
  Landmark,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { repo } from '../../lib/data'
import { findPaymentForUnit, receiptFallback, residentBillingUnits } from '../../lib/billing'
import { currentMonthKey, formatDate, money, monthLabel, todayISO } from '../../lib/utils'
import { downloadReceiptPdf } from '../../lib/pdf'
import PaymentFields, {
  emptyPaymentValues,
  validatePaymentFields,
} from '../../components/PaymentFields'
import PaymentDetailModal from '../../components/PaymentDetailModal'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { Select } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/Badge'
import { InlineError, MonthSelect, PageHeader, PageSkeleton } from '../../components/ui/Misc'
import EmptyState from '../../components/ui/EmptyState'

function MaintenanceContent() {
  const { user } = useAuth()
  const toast = useToast()
  const [unitKey, setUnitKey] = useState('')
  const [month, setMonth] = useState(currentMonthKey())
  const [values, setValues] = useState(emptyPaymentValues)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [detailPayment, setDetailPayment] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [apartments, combined, payments] = await Promise.all([
      repo.apartments.mine(user.id),
      repo.combined.list(),
      repo.payments.list({}),
    ])
    return { units: residentBillingUnits(apartments, combined, user.id), payments }
  }, [user.id])

  const units = data?.units || []
  const unit = units.find((item) => item.key === unitKey) || units[0] || null
  const payments = data?.payments || []
  const existing = unit ? findPaymentForUnit(payments, unit.key, month) : { status: 'unpaid', payment: null }

  useEffect(() => {
    if (units.length && !units.some((item) => item.key === unitKey)) {
      setUnitKey(units[0].key)
    }
  }, [units, unitKey])

  useEffect(() => {
    if (!unit) return
    setValues({
      ...emptyPaymentValues,
      amount: unit.maintenance_amount ? String(unit.maintenance_amount) : '',
      paymentDate: todayISO(),
    })
    setErrors({})
  }, [unit?.key, month])

  const setValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!unit) return
    const validation = validatePaymentFields(values)
    if (Object.keys(validation).length) {
      setErrors(validation)
      return
    }
    setSubmitting(true)
    try {
      await repo.payments.submit({
        unit,
        month,
        amount: Number(values.amount),
        paymentDate: values.paymentDate,
        method: values.method,
        transactionId: values.transactionId,
        upiId: values.upiId,
        notes: values.notes,
      })
      toast.success(
        values.method === 'cash'
          ? 'Payment details saved. Your cash payment is pending treasurer confirmation.'
          : 'Payment details saved. The treasurer will verify your transfer and confirm it.',
      )
      await reload()
      setValues({
        ...emptyPaymentValues,
        amount: unit.maintenance_amount ? String(unit.maintenance_amount) : '',
        paymentDate: todayISO(),
      })
    } catch (err) {
      toast.error(err.message || 'Could not submit your payment.')
    } finally {
      setSubmitting(false)
    }
  }

  const downloadReceipt = async (payment) => {
    if (!payment) return
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

  if (loading && !data) return <PageSkeleton />
  if (error && !data) return <InlineError message={error.message} onRetry={reload} />

  if (!unit) {
    return (
      <div>
        <PageHeader
          title="Maintenance"
          description="Submit your monthly maintenance payment details."
        />
        <Card>
          <EmptyState
            icon={Building2}
            title="No apartment is linked to your account"
            description="Please ask the treasurer to link your apartment. Once linked, you can submit maintenance payments here."
          />
          <div className="rounded-2xl bg-brand-50 p-4 text-center text-[0.9rem] leading-relaxed text-brand-800">
            Signed in as <span className="font-semibold">{user.email}</span>
          </div>
        </Card>
      </div>
    )
  }

  const canSubmit = existing.status === 'unpaid' || existing.status === 'rejected'

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Submit your payment details. The treasurer confirms the payment and generates your receipt."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                name="unit"
                label="Apartment"
                value={unit.key}
                onChange={(event) => setUnitKey(event.target.value)}
                options={units.map((item) => ({
                  value: item.key,
                  label: `${item.label} · ${money(item.maintenance_amount)}`,
                }))}
                disabled={units.length === 1}
              />
              <MonthSelect value={month} onChange={setMonth} months={8} label="Maintenance month" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl gpay-gradient-soft p-4">
              <div>
                <p className="text-[0.85rem] font-medium text-slate-500">
                  {monthLabel(month)} maintenance
                </p>
                <p className="mt-0.5 text-[1.7rem] font-bold leading-none text-slate-900">
                  {money(unit.maintenance_amount)}
                </p>
              </div>
              <StatusBadge status={existing.status} long={existing.status === 'pending'} />
            </div>
            <p className="mt-3 flex items-start gap-2 text-[0.85rem] leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              Maintenance month is the month of usage (e.g. October 2026). The payment date is the day you
              actually paid — they can be different months.
            </p>
          </Card>

          {existing.status === 'pending' && existing.payment ? (
            <Card className="border-amber-100 bg-amber-50/50">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <Clock className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.08rem] font-semibold text-slate-900">
                    Pending treasurer confirmation
                  </h2>
                  <p className="mt-1 text-[0.93rem] leading-relaxed text-slate-600">
                    Your payment details for {monthLabel(month)} were received on{' '}
                    {formatDate(existing.payment.payment_date)}. The treasurer will confirm it and your
                    receipt will be available immediately after.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setDetailPayment(existing.payment)}>
                      View payment details
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {existing.status === 'confirmed' && existing.payment ? (
            <Card className="border-emerald-100 bg-emerald-50/50">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.08rem] font-semibold text-slate-900">
                    {monthLabel(month)} is paid
                  </h2>
                  <p className="mt-1 text-[0.93rem] leading-relaxed text-slate-600">
                    {money(existing.payment.amount_paid)} received on{' '}
                    {formatDate(existing.payment.payment_date)}. Receipt number{' '}
                    <span className="font-semibold text-slate-800">{existing.payment.receipt_number}</span>.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      icon={Download}
                      loading={downloading}
                      onClick={() => downloadReceipt(existing.payment)}
                    >
                      Download receipt
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setDetailPayment(existing.payment)}>
                      View details
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {existing.status === 'rejected' && existing.payment ? (
            <Card className="border-rose-100 bg-rose-50/50">
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                  <AlertTriangle className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-[1.08rem] font-semibold text-slate-900">Previous submission rejected</h2>
                  <p className="mt-1 text-[0.93rem] leading-relaxed text-slate-600">
                    {existing.payment.rejection_reason ||
                      'Please check your details and submit the payment again.'}
                  </p>
                  <p className="mt-2 text-[0.9rem] font-medium text-slate-700">
                    You can submit corrected details below.
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {canSubmit ? (
            <Card>
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <PaymentFields
                  values={values}
                  setValue={setValue}
                  errors={errors}
                  amountDue={unit.maintenance_amount}
                />

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-[0.85rem] leading-relaxed text-slate-600">
                  {values.method === 'cash'
                    ? 'Cash payments stay pending until the treasurer confirms that the money was received.'
                    : 'The treasurer checks the transaction ID against the bank statement before confirming.'}
                </div>

                <Button type="submit" fullWidth loading={submitting}>
                  Submit payment details
                </Button>
                <p className="text-center text-sm text-slate-500">
                  A receipt is generated automatically after confirmation.
                </p>
              </form>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="text-[1.05rem] font-semibold text-slate-900">Your unit</h2>
            <dl className="mt-3 space-y-3 text-[0.92rem]">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Apartment</dt>
                <dd className="font-semibold text-slate-900">{unit.label}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Resident</dt>
                <dd className="max-w-[60%] text-right font-semibold text-slate-900">
                  {unit.resident_names}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Monthly maintenance</dt>
                <dd className="font-semibold text-slate-900">{money(unit.maintenance_amount)}</dd>
              </div>
              {unit.is_combined ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Billing</dt>
                  <dd className="text-right text-slate-700">Combined unit — one shared payment</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <div className="rounded-3xl bg-white p-5 shadow-soft">
            <h2 className="flex items-center gap-2 text-[1rem] font-semibold text-slate-900">
              <BadgeCheck className="h-5 w-5 text-brand-600" /> How it works
            </h2>
            <ol className="mt-3 space-y-3 text-[0.9rem] leading-relaxed text-slate-600">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  1
                </span>
                Submit the amount, date and method here.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  2
                </span>
                The treasurer confirms cash or verifies the bank transfer.
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                  3
                </span>
                Your receipt appears in History for download.
              </li>
            </ol>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              <Landmark className="h-4 w-4 shrink-0" /> Keep your UTR / transaction ID handy for bank payments.
            </div>
          </div>
        </div>
      </div>

      <PaymentDetailModal
        payment={detailPayment}
        open={Boolean(detailPayment)}
        onClose={() => setDetailPayment(null)}
      />
    </div>
  )
}

export default function ResidentMaintenance() {
  const { isOfficer } = useAuth()
  if (isOfficer) return <Navigate to="/admin/collections" replace />
  return <MaintenanceContent />
}
