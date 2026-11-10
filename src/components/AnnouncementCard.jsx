import { Droplets, Megaphone, Zap } from 'lucide-react'
import { cn, formatDate, relativeDay } from '../lib/utils'
import { Pill } from './ui/Badge'

export const ANNOUNCEMENT_META = {
  water: { label: 'Water', Icon: Droplets, tone: 'bg-sky-50 text-sky-600', pill: 'brand' },
  electrical: { label: 'Electrical', Icon: Zap, tone: 'bg-amber-50 text-amber-600', pill: 'amber' },
  general: { label: 'General', Icon: Megaphone, tone: 'bg-brand-50 text-brand-600', pill: 'brand' },
}

export default function AnnouncementCard({ announcement, compact = false, actions, className }) {
  const meta = ANNOUNCEMENT_META[announcement.category] || ANNOUNCEMENT_META.general
  const Icon = meta.Icon
  return (
    <article
      className={cn(
        'rounded-2xl border border-slate-100 bg-white p-4 transition',
        compact ? '' : 'sm:p-5',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', meta.tone)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={meta.pill}>{meta.label}</Pill>
            <span className="text-xs font-medium text-slate-500">
              {compact ? relativeDay(announcement.published_at) : formatDate(announcement.published_at)}
            </span>
            {!announcement.is_active ? <Pill tone="rose">Hidden</Pill> : null}
          </div>
          <h3 className={cn('mt-2 font-semibold leading-snug text-slate-900', compact ? 'text-[1rem]' : 'text-[1.08rem]')}>
            {announcement.title}
          </h3>
          <p
            className={cn(
              'mt-1 whitespace-pre-line text-[0.93rem] leading-relaxed text-slate-600',
              compact ? 'line-clamp-2' : '',
            )}
          >
            {announcement.message}
          </p>
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </article>
  )
}
