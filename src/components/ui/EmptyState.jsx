import { cn } from '../../lib/utils'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = 'brand',
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-500',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-500',
  }
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-10 text-center', className)}>
      {Icon ? (
        <span className={cn('mb-4 flex h-16 w-16 items-center justify-center rounded-3xl', tones[tone])}>
          <Icon className="h-8 w-8" />
        </span>
      ) : null}
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[0.95rem] leading-relaxed text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
