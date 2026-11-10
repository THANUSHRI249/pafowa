import { cn } from '../../lib/utils'

const TONES = {
  brand: { icon: 'bg-brand-50 text-brand-600', value: 'text-slate-900' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
  grape: { icon: 'bg-grape-50 text-grape-600', value: 'text-grape-600' },
  amber: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-700' },
  rose: { icon: 'bg-rose-50 text-rose-600', value: 'text-rose-700' },
}

export default function StatCard({ label, value, icon: Icon, tone = 'brand', sub, className, onClick }) {
  const style = TONES[tone] || TONES.brand
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-soft sm:p-5',
        onClick && 'transition hover:-translate-y-0.5 hover:border-brand-100',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.9rem] font-medium leading-snug text-slate-500">{label}</p>
        {Icon ? (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', style.icon)}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      <p className={cn('mt-3 text-[1.55rem] font-bold leading-none tracking-tight sm:text-[1.7rem]', style.value)}>
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[0.85rem] leading-snug text-slate-500">{sub}</p> : null}
    </Tag>
  )
}
