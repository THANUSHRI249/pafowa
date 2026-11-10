import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Banknote,
  Check,
  ChevronRight,
  Clock,
  Landmark,
  Plus,
  ReceiptText,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { repo } from '../../lib/data'
import {
  buildBillingUnits,
  findPaymentForUnit,
  receiptFallback,
  summarizeMonth,
} from '../../lib/billing'
import {
  currentMonthKey,
  formatDate,
  money,
  monthLabel,
  monthKeyOf,
  todayISO,
  cn,
} from '../../lib/utils'
import { downloadReceiptPdf, receiptBlob } from '../../lib/pdf'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import { Checkbox, Select, TextArea } from '../../components/ui/Input'
import { StatusBadge } from '../../components/ui/Badge'
import { InlineError, MonthSelect, PageHeader, PageSkeleton } from '../../components/ui/Misc'
import EmptyState from '../../components/ui/EmptyState'
import PaymentFields, {
  emptyPaymentValues,
  validatePaymentFields,
} from '../../components/PaymentFields'
import PaymentDetailModal from '../../components/PaymentDetailModal'

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'all', label: 'All payments' },
  { key: 'unpaid', label: 'Not paid' },
]

export default function Collections() {
  const { isTreasurer } = useAuth()
  const toast = useToast()
  const [month, setMonth] = useState(currentMonthKey())
  const [tab, setTab] = useState('pending')
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [confirmingId, setConfirmingId] = useState('')
  const [rejecting, setRejecting] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSaving, setRejectSaving] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordErrors, setRecordErrors] = useState({})
  const [recordSaving, setRecordSaving] = useState(false)
  const [recordForm, setRecordForm] = useState({ ...emptyPaymentValues, unitKey: '', month, confirmNow: true })

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [apartments, combined, payments] = await Promise.all([
      repo.apartments.list({}),
      repo.combined.list(),
      repo.payments.list({}),
    ])
    return { units: buildBillingUnits(apartments, combined), payments }
  }, [])

  const units = data?.units || []
  const payments = data?.payments || []
  const summary = useMemo(
    () => (data ? summarizeMonth({ units, payments, month }) : null),
    [data, units, payments, month],
  )

  if (loading && !data) return <PageSkeleton />
  if (error && !data) return <InlineError message={error.message} onRetry={reload} />
  if (!summary) return null

  const pendingRows = summary.pending
  const monthRows = [...summary.monthPayments].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  )
  const unpaidRows = summary.unpaidUnits

  const downloadReceipt = async (payment, receipt = null) => {
    try {
      const data = receipt || (await repo.receipts.getByPayment(payment.id).catch(() => null))
      await downloadReceiptPdf(data || receiptFallback(payment))
    } catch {
      toast.error('Could not create the receipt PDF.')
    }
  }

  const confirmPayment = async (payment) => {
    setConfirmingId(payment.id)
    try {
      const result = await repo.payments.confirm(payment.id)
      const receipt = result.receipt
      if (receipt) {
        try {
          const blob = await receiptBlob(receipt)
          repo.receipts.archivePdf(receipt, blob).catch(() => {})
        } catch {
          // PDF archiving is best-effort; the receipt record is already saved.
        }
      }
      toast.success(
        receipt
          ? `Payment confirmed. Receipt ${receipt.receipt_number} generated.`
          : 'Payment confirmed.',
        {
          duration: 9000,
          action: receipt
            ? {
                label: 'Download receipt',
                onClick: async () => {
                  try {
                    await downloadReceiptPdf(receipt)
                  } catch {
                    toast.error('Could not create the receipt PDF.')
                  }
                },
              }
            : undefined,
        },
      )
      setSelectedPayment(null)
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not confirm the payment.')
    } finally {
      setConfirmingId('')
    }
  }

  const submitReject = async () => {
    if (!rejecting) return
    if (!rejectReason.trim()) {
      toast.error('Please write a reason so the resident knows what to correct.')
      return
    }
    setRejectSaving(true)
    try {
      await repo.payments.reject(rejecting.id, rejectReason)
      toast.success('Payment rejected. The resident can submit corrected details.')
      setRejecting(null)
      setRejectReason('')
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not reject the payment.')
    } finally {
      setRejectSaving(false)
    }
  }

  const openRecord = (unitKey) => {
    const target = units.find((unit) => unit.key === unitKey) || units[0]
    setRecordForm({
      ...emptyPaymentValues,
      unitKey: target?.key || '',
      month,
      amount: target?.maintenance_amount ? String(target.maintenance_amount) : '',
      paymentDate: todayISO(),
      method: 'cash',
      confirmNow: true,
    })
    setRecordErrors({})
    setRecordOpen(true)
  }

  const setRecordValue = (key, value) => {
    setRecordForm((current) => {
      if (key === 'unitKey') {
        const target = units.find((unit) => unit.key === value)
        return {
          ...current,
          unitKey: value,
          amount: target?.maintenance_amount ? String(target.maintenance_amount) : current.amount,
        }
      }
      return { ...current, [key]: value }
    })
    setRecordErrors((current) => ({ ...current, [key]: undefined }))
  }

  const selectedUnit = units.find((unit) => unit.key === recordForm.unitKey) || null
  const selectionExisting = selectedUnit
    ? findPaymentForUnit(payments, selectedUnit.key, recordForm.month)
    : { status: 'unpaid' }
  const selectionBlocked =
    selectionExisting.status === 'pending' || selectionExisting.status === 'confirmed'

  const saveRecord = async (event) => {
    event.preventDefault()
    if (!selectedUnit) {
      setRecordErrors({ unitKey: 'Choose the apartment or combined unit.' })
      return
    }
    if (selectionBlocked) return
    const validation = validatePaymentFields(recordForm)
    setRecordErrors(validation)
    if (Object.keys(validation).length) return
    setRecordSaving(true)
    try {
      const { payment, receipt } = await repo.payments.record({
        unit: selectedUnit,
        month: recordForm.month,
        amount: Number(recordForm.amount),
        paymentDate: recordForm.paymentDate,
        method: recordForm.method,
        transactionId: recordForm.transactionId,
        upiId: recordForm.upiId,
        notes: recordForm.notes,
        confirm: recordForm.confirmNow,
      })
      if (receipt) {
        try {
          const blob = await receiptBlob(receipt)
          repo.receipts.archivePdf(receipt, blob).catch(() => {})
        } catch {
          // best-effort archive
        }
        toast.success(`Payment recorded and confirmed. Receipt ${receipt.receipt_number}.`, {
          action: { label: 'Download receipt', onClick: () => downloadReceiptPdf(receipt).catch(() => {}) },
          duration: 9000,
        })
      } else {
        toast.success('Payment recorded. It is waiting for confirmation.', {
          action: {
            label: 'Open pending',
            onClick: () => {
              setTab('pending')
              setSelectedPayment(payment)
            },
          },
        })
      }
      setRecordOpen(false)
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not record the payment.')
    } finally {
      setRecordSaving(false)
    }
  }

  const tabCounts = {
    pending: pendingRows.length,
    all: monthRows.length,
    unpaid: unpaidRows.length,
  }

  return (
    <div>
      <PageHeader
        title="Maintenance collections"
        description={
          isTreasurer
            ? 'Confirm resident payments, record cash and bank collections, and generate receipts.'
            : 'Review resident payments, pending confirmations and receipts. Only the treasurer can record or confirm.'
        }
        action={
          isTreasurer ? (
            <Button icon={Plus} onClick={() => openRecord()}>
              Record payment
            </Button>
          ) : null
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:w-64">
            <MonthSelect value={month} onChange={setMonth} label="Maintenance month" />
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2 sm:max-w-md">
            <div className="rounded-2xl bg-emerald-50 p-3 text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-700">Collected</p>
              <p className="mt-1 text-[0.95rem] font-bold text-emerald-800">
                {money(summary.totalCollection)}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-amber-700">Pending</p>
              <p className="mt-1 text-[0.95rem] font-bold text-amber-800">
                {money(summary.pendingAmount)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-600">Not paid</p>
              <p className="mt-1 text-[0.95rem] font-bold text-slate-700">
                {summary.unpaidUnits.length} units
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition',
              tab === item.key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {item.label}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs',
                tab === item.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
              )}
            >
              {tabCounts[item.key]}
            </span>
          </button>
        ))}
      </div>

      {tab === 'pending' ? (
        pendingRows.length === 0 ? (
          <Card>
            <EmptyState
              icon={Check}
              title="No payments waiting"
              description={`Every recorded payment for ${monthLabel(month)} has been confirmed or there are no submissions yet.`}
              tone="emerald"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingRows.map((payment) => (
              <Card key={payment.id} className="border-amber-100">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={
                        payment.payment_method === 'bank'
                          ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grape-50 text-grape-600'
                          : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600'
                      }
                    >
                      {payment.payment_method === 'bank' ? (
                        <Landmark className="h-5 w-5" />
                      ) : (
                        <Banknote className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <h3 className="text-[1.05rem] font-semibold text-slate-900">
                        {payment.unit_label}
                        <span className="ml-2 text-sm font-medium text-slate-500">
                          {payment.resident_name}
                        </span>
                      </h3>
                      <p className="mt-0.5 text-[0.9rem] text-slate-500">
                        {monthLabel(monthKeyOf(payment.maintenance_month))} · Paid on{' '}
                        {formatDate(payment.payment_date)} ·{' '}
                        {payment.payment_method === 'bank' ? 'Bank / UPI' : 'Cash'}
                      </p>
                      {payment.payment_method === 'bank' && payment.transaction_id ? (
                        <p className="mt-1 inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          UTR {payment.transaction_id}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[1.35rem] font-bold leading-none text-slate-900">
                      {money(payment.amount_paid)}
                    </p>
                    <StatusBadge status="pending" size="sm" className="mt-2" />
                  </div>
                </div>

                {payment.notes ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {payment.notes}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {isTreasurer ? (
                    <>
                      <Button
                        size="md"
                        icon={Check}
                        loading={confirmingId === payment.id}
                        onClick={() => confirmPayment(payment)}
                      >
                        {payment.payment_method === 'bank' ? 'Verify & confirm' : 'Confirm cash'}
                      </Button>
                      <Button size="md" variant="danger" icon={X} onClick={() => setRejecting(payment)}>
                        Reject
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="md"
                    variant="ghost"
                    onClick={() => setSelectedPayment(payment)}
                  >
                    Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === 'all' ? (
        monthRows.length === 0 ? (
          <Card>
            <EmptyState
              icon={ReceiptText}
              title="No payments this month"
              description={
                isTreasurer
                  ? 'Record a cash or bank payment, or ask residents to submit their payment details.'
                  : 'No payments recorded for this month yet.'
              }
              action={
                isTreasurer ? (
                  <Button size="md" icon={Plus} onClick={() => openRecord()}>
                    Record payment
                  </Button>
                ) : null
              }
            />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {monthRows.map((payment) => (
              <button
                key={payment.id}
                type="button"
                onClick={() => setSelectedPayment(payment)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-soft transition hover:border-brand-100 hover:bg-brand-50/20"
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
                  <p className="truncate text-[0.98rem] font-semibold text-slate-900">
                    {payment.unit_label}
                    <span className="ml-2 text-xs font-medium text-slate-500">{payment.resident_name}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {formatDate(payment.payment_date)} ·{' '}
                    {payment.payment_method === 'bank' ? 'Bank / UPI' : 'Cash'}
                    {payment.receipt_number ? ` · ${payment.receipt_number}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-[0.98rem] font-bold text-slate-900">{money(payment.amount_paid)}</p>
                  <StatusBadge status={payment.status} size="sm" />
                </div>
                <ChevronRight className="hidden h-5 w-5 text-slate-300 sm:block" />
              </button>
            ))}
          </div>
        )
      ) : null}

      {tab === 'unpaid' ? (
        unpaidRows.length === 0 ? (
          <Card>
            <EmptyState
              icon={Check}
              title="All units are paid"
              description={`Every billing unit for ${monthLabel(month)} has a confirmed payment.`}
              tone="emerald"
            />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {unpaidRows.map(({ unit, status, payment }) => (
              <div
                key={unit.key}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-soft"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[0.8rem] font-bold text-slate-600">
                  {unit.label.slice(0, 3)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.98rem] font-semibold text-slate-900">
                    {unit.label}
                    {unit.is_combined ? (
                      <span className="ml-2 rounded-full bg-grape-50 px-2 py-0.5 text-[0.65rem] font-semibold text-grape-600">
                        Combined
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {unit.resident_names}
                    {unit.contact_phone ? ` · ${unit.contact_phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[0.95rem] font-bold text-slate-900">
                      {money(unit.maintenance_amount)}
                    </p>
                    <StatusBadge status={status} size="sm" className="mt-1" />
                  </div>
                  {isTreasurer ? (
                    <Button
                      size="sm"
                      variant="soft"
                      icon={Plus}
                      onClick={() => openRecord(unit.key)}
                    >
                      Record
                    </Button>
                  ) : null}
                  {payment ? (
                    <button
                      type="button"
                      onClick={() => setSelectedPayment(payment)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="View rejected payment"
                    >
                      <AlertCircle className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      <div className="mt-5 flex items-start gap-2 rounded-2xl bg-brand-50/70 px-4 py-3 text-[0.85rem] leading-relaxed text-brand-800">
        <Users className="mt-0.5 h-4 w-4 shrink-0" />
        {isTreasurer
          ? 'Confirming a payment creates a numbered receipt and locks it into history. Rejected payments stay visible for the audit trail and can be resubmitted by the resident.'
          : 'Confirmed payments are locked into history with a numbered receipt. Only the treasurer can confirm or reject a payment.'}
      </div>

      <PaymentDetailModal
        payment={selectedPayment}
        open={Boolean(selectedPayment)}
        onClose={() => setSelectedPayment(null)}
      />

      <Modal
        open={Boolean(rejecting)}
        onClose={() => {
          setRejecting(null)
          setRejectReason('')
        }}
        title="Reject payment?"
        description={
          rejecting
            ? `${rejecting.unit_label} · ${money(rejecting.amount_paid)} · ${monthLabel(
                monthKeyOf(rejecting.maintenance_month),
              )}`
            : ''
        }
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setRejecting(null)
                setRejectReason('')
              }}
              disabled={rejectSaving}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={submitReject} loading={rejectSaving}>
              Reject payment
            </Button>
          </div>
        }
      >
        <TextArea
          label="Reason for rejection"
          name="rejectReason"
          rows={4}
          placeholder="e.g. The UTR does not match any bank transfer. Please check the transaction ID."
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
        />
        <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-500">
          The resident will see this reason. Rejected payments remain in history and can be resubmitted.
        </p>
      </Modal>

      <Modal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="Record payment"
        description="Record cash or bank money received by the association. Confirming now generates the receipt."
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setRecordOpen(false)} disabled={recordSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="record-payment-form"
              icon={ReceiptText}
              loading={recordSaving}
              disabled={selectionBlocked}
            >
              {recordForm.confirmNow ? 'Save & generate receipt' : 'Save as pending'}
            </Button>
          </div>
        }
      >
        <form id="record-payment-form" onSubmit={saveRecord} className="space-y-4" noValidate>
          <Select
            label="Apartment or combined unit"
            name="unit"
            value={recordForm.unitKey}
            onChange={(event) => setRecordValue('unitKey', event.target.value)}
            options={units.map((unit) => ({
              value: unit.key,
              label: `${unit.label} · ${unit.resident_names} · ${money(unit.maintenance_amount)}`,
            }))}
            placeholder="Choose a unit"
            error={recordErrors.unitKey}
          />
          <MonthSelect
            value={recordForm.month}
            onChange={(value) => setRecordValue('month', value)}
            months={12}
            label="Maintenance month"
          />

          {selectionBlocked ? (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[0.9rem] leading-relaxed text-amber-900">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {selectionExisting.status === 'confirmed'
                  ? 'This unit is already paid for the selected month. Choose another month.'
                  : 'A payment for this unit and month is already pending confirmation.'}
              </span>
            </div>
          ) : null}

          <PaymentFields
            values={recordForm}
            setValue={setRecordValue}
            errors={recordErrors}
            amountDue={selectedUnit?.maintenance_amount}
          />

          <Checkbox
            label="Mark as confirmed now"
            description="Use this when you have verified cash or the bank transfer. A receipt is generated immediately."
            checked={recordForm.confirmNow}
            onChange={(event) => setRecordValue('confirmNow', event.target.checked)}
          />
        </form>
      </Modal>
    </div>
  )
}
