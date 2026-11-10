import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSecurityOverview } from '../../hooks/useSecurityOverview'
import { cn } from '../../lib/utils'

export default function SecurityBanner() {
  const { isOfficer } = useAuth()
  const { data } = useSecurityOverview(isOfficer)

  const alerts = (data?.alerts || []).filter((alert) => !alert.acknowledged_at)
  if (!isOfficer || alerts.length === 0) return null

  const critical = alerts.some((alert) => alert.severity === 'critical')
  const newest = alerts[0]
  const Icon = critical ? ShieldAlert : AlertTriangle

  return (
    <Link
      to="/admin/security"
      className={cn(
        'mb-5 flex items-start gap-3 rounded-2xl border p-4 transition',
        critical
          ? 'border-rose-200 bg-rose-50 text-rose-900 hover:bg-rose-100/70'
          : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100/70',
      )}
      role="alert"
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
          critical ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700',
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[0.95rem] font-bold">
            {critical ? 'Security lockdown alert' : 'Security alert'}
          </span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide">
            {alerts.length} open
          </span>
        </span>
        <span className="mt-1 block text-[0.92rem] font-semibold">{newest.title}</span>
        <span className="mt-0.5 block text-[0.88rem] leading-relaxed opacity-90">{newest.message}</span>
      </span>
      <ArrowRight className="mt-1 h-5 w-5 shrink-0" />
    </Link>
  )
}
