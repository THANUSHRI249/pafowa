import { cn } from '../../lib/utils'

export default function Card({ children, className, padded = true, ...props }) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-slate-100 bg-white shadow-soft',
        padded && 'p-5 sm:p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, description, action, icon: Icon, className }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[1.12rem] font-semibold leading-snug text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}
