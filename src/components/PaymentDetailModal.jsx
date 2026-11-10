import { useEffect, useState } from 'react'
import { AlertTriangle, Download, FileText } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { StatusBadge } from './ui/Badge'
import { KeyValue } from './ui/Misc'
import { repo } from '../lib/data'
import { receiptFallback } from '../lib/billing'
import { downloadReceiptPdf } from '../lib/pdf'
import { formatDate, formatDateTime, money, monthLabel, monthKeyOf } from '../lib/utils'
import { useToast } from '../context/ToastContext'

export default function PaymentDetailModal({ payment, open, onClose }) {
  const toast = useToast()
  const [receipt, setReceipt] = useState(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!open || !payment) return undefined
    setReceipt(null)
    if (payment.status !== 'confirmed') return undefined
    let active = true
    setLoadingReceipt(true)
    repo.receipts
      .getByPayment(payment.id)
      .then((row) => {
        if (active) setReceipt(row)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingReceipt(false)
      })
    return () => {
      active = false
    }
  }, [open, payment])

  if (!payment) return null

  const downloadable =
    receipt || (payment.status === 'confirmed' ? receiptFallback(payment) : null)

  const handleDownload = async () => {
    if (!downloadable) return
    setDownloading(true)
    try {
      await downloadReceiptPdf(downloadable)
    } catch {
      toast.error('Could not create the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment details"
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {payment.status === 'confirmed' ? (
            <Button icon={Download} onClick={handleDownload} loading={downloading || loadingReceipt}>
              Download receipt
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="rounded-2xl gpay-gradient-soft p-5 text-center">
        <p className="text-sm font-medium text-slate-600">Amount paid</p>
        <p className="mt-1 text-[2rem] font-extrabold leading-none tracking-tight text-slate-900">
          {money(payment.amount_paid)}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <StatusBadge status={payment.status} long />
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-[0.82rem] font-semibold text-slate-600">
            {monthLabel(monthKeyOf(payment.maintenance_month))}
          </span>
        </div>
      </div>

      {payment.status === 'rejected' ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-[0.95rem] font-semibold text-rose-800">Payment rejected</p>
            <p className="mt-1 text-[0.9rem] leading-relaxed text-rose-700">
              {payment.rejection_reason || 'Please contact the treasurer for details.'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 divide-y divide-slate-100">
        <KeyValue label="Resident" value={payment.resident_name || '—'} />
        <KeyValue label="Apartment / unit" value={payment.unit_label || '—'} />
        <KeyValue label="Maintenance for" value={monthLabel(monthKeyOf(payment.maintenance_month))} />
        <KeyValue label="Payment date" value={formatDate(payment.payment_date)} />
        <KeyValue
          label="Payment method"
          value={payment.payment_method === 'bank' ? 'Bank / UPI' : 'Cash'}
        />
        {payment.payment_method === 'bank' ? (
          <>
            <KeyValue label="Transaction ID / UTR" value={payment.transaction_id || '—'} />
            {payment.upi_id ? <KeyValue label="UPI ID" value={payment.upi_id} /> : null}
          </>
        ) : null}
        <KeyValue
          label="Receipt number"
          value={
            payment.receipt_number ? (
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-400" />
                {payment.receipt_number}
              </span>
            ) : (
              'Generated after confirmation'
            )
          }
        />
        <KeyValue label="Submitted on" value={formatDateTime(payment.created_at)} />
        {payment.confirmed_at ? (
          <KeyValue label="Confirmed on" value={formatDateTime(payment.confirmed_at)} />
        ) : null}
        {payment.notes ? <KeyValue label="Notes" value={payment.notes} /> : null}
      </div>
    </Modal>
  )
}
