import { Loader2 } from 'lucide-react'
import { cn, initials, monthLabel, monthOptions } from '../../lib/utils'
import Button from './Button'
import Modal from './Modal'
import { Select } from './Input'

export function PageHeader({ title, description, action, eyebrow, className }) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
        ) : null}
        <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[1.85rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[0.98rem] leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function Spinner({ className }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} aria-hidden="true" />
}

export function LoadingBlock({ label = 'Loading…', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-14', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-brand-500" aria-hidden="true" />
      <p className="text-[0.95rem] font-medium text-slate-500">{label}</p>
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-2xl bg-slate-100', className)} />
}

export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-9 w-2/3 max-w-sm" />
        <Skeleton className="h-5 w-1/2 max-w-xs" />
      </div>
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-28 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-3xl" />
    </div>
  )
}

export function InlineError({ message, onRetry, className }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-rose-100 bg-rose-50/70 p-4 text-[0.95rem] text-rose-800',
        className,
      )}
      role="alert"
    >
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1 text-rose-700">{message}</p>
      {onRetry ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function Avatar({ name, size = 'md', className }) {
  const sizes = {
    sm: 'h-9 w-9 text-sm',
    md: 'h-11 w-11 text-[1rem]',
    lg: 'h-16 w-16 text-xl',
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700 ring-2 ring-white',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}

export function MonthSelect({ value, onChange, label = 'Month', months = 18, name = 'month', className }) {
  const options = monthOptions(months).map((month) => ({ value: month, label: monthLabel(month) }))
  if (!options.some((option) => option.value === value)) {
    options.unshift({ value, label: monthLabel(value) })
  }
  return (
    <Select
      name={name}
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={options}
      className={className}
    />
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading = false,
  children,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Modal>
  )
}

export function Divider({ className }) {
  return <div className={cn('h-px w-full bg-slate-100', className)} />
}

export function KeyValue({ label, value, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2.5', className)}>
      <span className="text-[0.92rem] text-slate-500">{label}</span>
      <span className="max-w-[60%] break-words text-right text-[0.95rem] font-semibold text-slate-900">
        {value}
      </span>
    </div>
  )
}
