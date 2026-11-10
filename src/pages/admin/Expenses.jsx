import { useMemo, useRef, useState } from 'react'
import {
  Ban,
  Banknote,
  Eye,
  Image as ImageIcon,
  Landmark,
  Paperclip,
  Plus,
  ReceiptText,
  Upload,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { repo } from '../../lib/data'
import { EXPENSE_CATEGORIES } from '../../lib/config'
import {
  cn,
  currentMonthKey,
  formatDate,
  money,
  monthLabel,
  monthOptions,
  todayISO,
} from '../../lib/utils'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import { Input, Select, TextArea } from '../../components/ui/Input'
import { Pill } from '../../components/ui/Badge'
import { InlineError, MonthSelect, PageHeader, PageSkeleton } from '../../components/ui/Misc'
import EmptyState from '../../components/ui/EmptyState'

export default function Expenses() {
  const { isTreasurer } = useAuth()
  const toast = useToast()
  const [month, setMonth] = useState(currentMonthKey())
  const [category, setCategory] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({
    expense_date: todayISO(),
    category: '',
    description: '',
    amount: '',
    paid_to: '',
    payment_method: 'cash',
    voucher_available: true,
  })
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [voiding, setVoiding] = useState(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidSaving, setVoidSaving] = useState(false)
  const fileRef = useRef(null)

  const { data, loading, error, reload } = useAsyncData(() => repo.expenses.list({}), [])

  const expenses = data || []

  const monthExpenses = useMemo(
    () => expenses.filter((expense) => String(expense.expense_date).slice(0, 7) === month),
    [expenses, month],
  )

  const filtered = useMemo(
    () =>
      monthExpenses.filter((expense) => category === 'all' || expense.category === category),
    [monthExpenses, category],
  )

  const totals = useMemo(() => {
    const active = filtered.filter((expense) => !expense.is_void)
    return {
      total: active.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      cash: active
        .filter((expense) => expense.payment_method === 'cash')
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      bank: active
        .filter((expense) => expense.payment_method === 'bank')
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
      vouchers: active.filter((expense) => expense.voucher_available).length,
    }
  }, [filtered])

  const openForm = () => {
    setForm({
      expense_date: todayISO(),
      category: '',
      description: '',
      amount: '',
      paid_to: '',
      payment_method: 'cash',
      voucher_available: true,
    })
    setFile(null)
    setErrors({})
    setFormOpen(true)
  }

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const chooseFile = (selected) => {
    if (!selected) return
    if (selected.size > 5 * 1024 * 1024) {
      toast.error('The voucher file must be smaller than 5 MB.')
      return
    }
    setFile(selected)
    setValue('voucher_available', true)
  }

  const save = async (event) => {
    event.preventDefault()
    const next = {}
    if (!form.expense_date) next.expense_date = 'Choose the expense date.'
    else if (form.expense_date > todayISO()) next.expense_date = 'The date cannot be in the future.'
    if (!form.category) next.category = 'Choose a category.'
    if (!form.description.trim()) next.description = 'Enter a short description.'
    if (!(Number(form.amount) > 0)) next.amount = 'Enter an amount greater than zero.'
    if (!form.paid_to.trim()) next.paid_to = 'Enter who was paid.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      await repo.expenses.create(
        {
          ...form,
          amount: Number(form.amount),
          voucher_available: form.voucher_available || Boolean(file),
        },
        file,
      )
      toast.success('Expense saved.')
      setFormOpen(false)
      setFile(null)
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not save the expense.')
    } finally {
      setSaving(false)
    }
  }

  const viewVoucher = async (expense) => {
    if (!expense.voucher_path) {
      toast.info(
        expense.voucher_available
          ? 'A voucher was marked available, but no file was uploaded.'
          : 'No voucher was recorded for this expense.',
      )
      return
    }
    const url = await repo.expenses.voucherUrl(expense.voucher_path)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      toast.error('Could not open the voucher file.')
    }
  }

  const submitVoid = async () => {
    if (!voiding) return
    if (!voidReason.trim()) {
      toast.error('Write a reason for voiding this expense.')
      return
    }
    setVoidSaving(true)
    try {
      await repo.expenses.voidExpense(voiding.id, voidReason)
      toast.success('Expense voided. The record remains in history.')
      setVoiding(null)
      setVoidReason('')
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not void the expense.')
    } finally {
      setVoidSaving(false)
    }
  }

  const monthFilterOptions = [
    { value: 'all', label: 'Month total' },
    ...monthOptions(12).map((value) => ({ value, label: monthLabel(value) })),
  ]

  if (loading && !data) return <PageSkeleton />
  if (error && !data) return <InlineError message={error.message} onRetry={reload} />

  return (
    <div>
      <PageHeader
        title="Daily expenses"
        description={
          isTreasurer
            ? 'Record money spent on plumbing, electrical work, water, cleaning and repairs.'
            : 'Review association spending, vouchers and category totals. Only the treasurer can add or void expenses.'
        }
        action={
          isTreasurer ? (
            <Button icon={Plus} onClick={openForm}>
              Add expense
            </Button>
          ) : null
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[16rem_16rem_minmax(0,1fr)]">
          <MonthSelect value={month} onChange={setMonth} label="Month" />
          <Select
            name="category"
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={[
              { value: 'all', label: 'All categories' },
              ...EXPENSE_CATEGORIES.map((item) => ({ value: item, label: item })),
            ]}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-500">
                Total spent
              </p>
              <p className="mt-1 text-[1rem] font-bold text-slate-900">{money(totals.total)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-emerald-700">Cash</p>
              <p className="mt-1 text-[1rem] font-bold text-emerald-800">{money(totals.cash)}</p>
            </div>
            <div className="rounded-2xl bg-grape-50 p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-grape-600">Bank</p>
              <p className="mt-1 text-[1rem] font-bold text-grape-600">{money(totals.bank)}</p>
            </div>
            <div className="rounded-2xl bg-brand-50 p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-brand-700">
                Vouchers
              </p>
              <p className="mt-1 text-[1rem] font-bold text-brand-700">{totals.vouchers}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">
          {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'} · {monthLabel(month)}
        </p>
        {category !== 'all' ? (
          <button
            type="button"
            onClick={() => setCategory('all')}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50"
          >
            Clear category
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ReceiptText}
            title="No expenses recorded"
            description={`No ${category === 'all' ? '' : `${category.toLowerCase()} `}expenses for ${monthLabel(month)}.${isTreasurer ? ' Add one when the association spends money.' : ''}`}
            action={
              isTreasurer ? (
                <Button size="md" icon={Plus} onClick={openForm}>
                  Add expense
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((expense) => (
            <Card key={expense.id} className={cn('p-4 sm:p-5', expense.is_void && 'opacity-70')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <ReceiptText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={cn(
                          'text-[1.02rem] font-semibold text-slate-900',
                          expense.is_void && 'line-through',
                        )}
                      >
                        {expense.description}
                      </h3>
                      {expense.is_void ? <Pill tone="rose">Voided</Pill> : null}
                    </div>
                    <p className="mt-0.5 text-[0.88rem] text-slate-500">
                      {formatDate(expense.expense_date)} · {expense.paid_to}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Pill tone="slate">{expense.category}</Pill>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                        {expense.payment_method === 'bank' ? (
                          <Landmark className="h-3.5 w-3.5" />
                        ) : (
                          <Banknote className="h-3.5 w-3.5" />
                        )}
                        {expense.payment_method === 'bank' ? 'Bank / UPI' : 'Cash'}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium',
                          expense.voucher_available ? 'text-emerald-700' : 'text-slate-400',
                        )}
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {expense.voucher_available ? 'Voucher' : 'No voucher'}
                      </span>
                    </div>
                    {expense.is_void && expense.void_reason ? (
                      <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        Voided: {expense.void_reason}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <p
                    className={cn(
                      'text-[1.22rem] font-bold leading-none',
                      expense.is_void ? 'text-slate-400 line-through' : 'text-slate-900',
                    )}
                  >
                    {money(expense.amount)}
                  </p>
                  <div className="flex items-center gap-1">
                    {expense.voucher_path || expense.voucher_available ? (
                      <button
                        type="button"
                        onClick={() => viewVoucher(expense)}
                        className="flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        <Eye className="h-4 w-4" /> View
                      </button>
                    ) : null}
                    {!expense.is_void && isTreasurer ? (
                      <button
                        type="button"
                        onClick={() => {
                          setVoiding(expense)
                          setVoidReason('')
                        }}
                        className="flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Ban className="h-4 w-4" /> Void
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-start gap-2 rounded-2xl bg-slate-100/70 px-4 py-3 text-[0.85rem] leading-relaxed text-slate-600">
        <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
        {isTreasurer
          ? `Expenses are never deleted — use Void to correct a mistake while keeping the audit trail. Use the ${monthFilterOptions.length - 1}-month filter to review older records.`
          : 'Expenses are never deleted. Voided entries stay visible with their reason so the audit trail is preserved.'}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add expense"
        description="Record association spending with an optional bill or voucher."
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="expense-form" loading={saving}>
              Save expense
            </Button>
          </div>
        }
      >
        <form id="expense-form" onSubmit={save} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date"
              name="expense_date"
              type="date"
              max={todayISO()}
              value={form.expense_date}
              onChange={(event) => setValue('expense_date', event.target.value)}
              error={errors.expense_date}
            />
            <Input
              label="Amount"
              name="amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="0.01"
              prefix="₹"
              placeholder="0"
              value={form.amount}
              onChange={(event) => setValue('amount', event.target.value)}
              error={errors.amount}
            />
          </div>

          <Select
            label="Category"
            name="category"
            value={form.category}
            onChange={(event) => setValue('category', event.target.value)}
            options={EXPENSE_CATEGORIES.map((item) => ({ value: item, label: item }))}
            placeholder="Choose a category"
            error={errors.category}
          />

          <Input
            label="Description"
            name="description"
            placeholder="e.g. Repair leaking valve in Block A"
            value={form.description}
            onChange={(event) => setValue('description', event.target.value)}
            error={errors.description}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Paid to"
              name="paid_to"
              placeholder="e.g. Ravi Plumbing Works"
              value={form.paid_to}
              onChange={(event) => setValue('paid_to', event.target.value)}
              error={errors.paid_to}
            />
            <Select
              label="Payment method"
              name="payment_method"
              value={form.payment_method}
              onChange={(event) => setValue('payment_method', event.target.value)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank / UPI' },
              ]}
            />
          </div>

          <div>
            <p className="mb-1.5 text-[0.95rem] font-medium text-slate-700">Voucher available?</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ].map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    setValue('voucher_available', option.value)
                    if (!option.value) setFile(null)
                  }}
                  className={cn(
                    'min-h-12 rounded-2xl border-2 text-[0.98rem] font-semibold transition',
                    form.voucher_available === option.value
                      ? 'border-brand-500 bg-brand-50/60 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {form.voucher_available ? (
            <div>
              <p className="mb-1.5 text-[0.95rem] font-medium text-slate-700">
                Bill or voucher <span className="text-xs font-normal text-slate-400">optional</span>
              </p>
              {file ? (
                <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
                  <Paperclip className="h-5 w-5 shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.92rem] font-semibold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                    className="rounded-full p-2 text-slate-500 hover:bg-white"
                    aria-label="Remove selected file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition hover:border-brand-300 hover:bg-brand-50/30">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
                    <Upload className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[0.95rem] font-semibold text-slate-800">
                      Upload bill or voucher
                    </span>
                    <span className="block text-xs text-slate-500">JPG, PNG or PDF · up to 5 MB</span>
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(event) => chooseFile(event.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(voiding)}
        onClose={() => {
          setVoiding(null)
          setVoidReason('')
        }}
        title="Void this expense?"
        description={
          voiding ? `${voiding.description} · ${money(voiding.amount)} · ${formatDate(voiding.expense_date)}` : ''
        }
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setVoiding(null)
                setVoidReason('')
              }}
              disabled={voidSaving}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={submitVoid} loading={voidSaving}>
              Void expense
            </Button>
          </div>
        }
      >
        <TextArea
          label="Reason"
          name="voidReason"
          rows={3}
          placeholder="e.g. Duplicate entry — already recorded under Repairs."
          value={voidReason}
          onChange={(event) => setVoidReason(event.target.value)}
        />
        <p className="mt-3 text-[0.85rem] leading-relaxed text-slate-500">
          The expense stays in the list, excluded from totals, so the financial record is never silently
          deleted.
        </p>
      </Modal>
    </div>
  )
}
