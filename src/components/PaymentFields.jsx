import { Banknote, Check, Landmark } from 'lucide-react'
import { Input, TextArea } from './ui/Input'
import { cn, money, todayISO } from '../lib/utils'

const METHODS = [
  {
    value: 'cash',
    title: 'Cash',
    description: 'Hand over to the treasurer',
    icon: Banknote,
  },
  {
    value: 'bank',
    title: 'Bank / UPI',
    description: 'Transfer, UPI or cheque',
    icon: Landmark,
  },
]

export function PaymentMethodPicker({ value, onChange, error }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.95rem] font-medium text-slate-700">Payment method</p>
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-3">
        {METHODS.map((method) => {
          const selected = value === method.value
          return (
            <button
              key={method.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(method.value)}
              className={cn(
                'relative min-h-[5.4rem] rounded-2xl border-2 p-3.5 text-left transition',
                selected
                  ? 'border-brand-500 bg-brand-50/60'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <span
                className={cn(
                  'mb-2 flex h-9 w-9 items-center justify-center rounded-xl',
                  selected ? 'bg-white text-brand-600' : 'bg-slate-100 text-slate-500',
                )}
              >
                <method.icon className="h-5 w-5" />
              </span>
              <span className="block text-[0.98rem] font-semibold text-slate-900">{method.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">{method.description}</span>
              {selected ? (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function validatePaymentFields(values) {
  const errors = {}
  const amount = Number(values.amount)
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Enter an amount greater than zero.'
  if (!values.paymentDate) {
    errors.paymentDate = 'Choose the payment date.'
  } else if (values.paymentDate > todayISO()) {
    errors.paymentDate = 'The payment date cannot be in the future.'
  }
  if (!values.method) errors.method = 'Choose cash or bank.'
  if (values.method === 'bank' && !String(values.transactionId || '').trim()) {
    errors.transactionId = 'Enter the transaction ID or UTR number.'
  }
  return errors
}

export default function PaymentFields({
  values,
  setValue,
  errors = {},
  amountDue,
  disabled = false,
  showNotes = true,
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Amount paid"
          name="amount"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          prefix="₹"
          placeholder="0"
          value={values.amount}
          onChange={(event) => setValue('amount', event.target.value)}
          error={errors.amount}
          hint={amountDue != null ? `Amount due: ${money(amountDue)}` : undefined}
          disabled={disabled}
        />
        <Input
          label="Payment date"
          name="paymentDate"
          type="date"
          max={todayISO()}
          value={values.paymentDate}
          onChange={(event) => setValue('paymentDate', event.target.value)}
          error={errors.paymentDate}
          hint="The day the money was paid"
          disabled={disabled}
        />
      </div>

      <PaymentMethodPicker
        value={values.method}
        onChange={(method) => setValue('method', method)}
        error={errors.method}
      />

      {values.method === 'bank' ? (
        <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
          <Input
            label="Transaction ID / UTR"
            name="transactionId"
            placeholder="e.g. UTR5241873960"
            value={values.transactionId}
            onChange={(event) => setValue('transactionId', event.target.value.toUpperCase())}
            error={errors.transactionId}
            hint="Found in your bank or UPI app"
            disabled={disabled}
          />
          <Input
            label="UPI ID"
            name="upiId"
            placeholder="name@okhdfcbank"
            optional
            value={values.upiId}
            onChange={(event) => setValue('upiId', event.target.value)}
            disabled={disabled}
          />
        </div>
      ) : null}

      {showNotes ? (
        <TextArea
          label="Notes"
          name="notes"
          placeholder="Anything the treasurer should know (optional)"
          optional
          rows={3}
          value={values.notes}
          onChange={(event) => setValue('notes', event.target.value)}
          disabled={disabled}
        />
      ) : null}
    </div>
  )
}

export const emptyPaymentValues = {
  amount: '',
  paymentDate: todayISO(),
  method: 'bank',
  transactionId: '',
  upiId: '',
  notes: '',
}
