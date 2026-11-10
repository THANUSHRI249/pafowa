import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

const STYLES = {
  confirmed: {
    label: 'Paid',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    Icon: CheckCircle2,
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
    Icon: Clock,
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-50 text-rose-700 ring-rose-100',
    Icon: XCircle,
  },
  unpaid: {
    label: 'Not paid',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
    Icon: Circle,
  },
}

export function StatusBadge({ status, label, className, long = false, size = 'md' }) {
  const style = STYLES[status] || STYLES.unpaid
  const Icon = style.Icon
  const text =
    label ||
    (long && status === 'pending'
      ? 'Awaiting treasurer'
      : long && status === 'unpaid'
        ? 'Not paid yet'
        : style.label)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[0.82rem]',
        style.className,
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" />
      {text}
    </span>
  )
}

export function Pill({ children, className, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-50 text-brand-700',
    grape: 'bg-grape-50 text-grape-600',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        tones[tone] || tones.slate,
        className,
      )}
    >
      {children}
    </span>
  )
}
