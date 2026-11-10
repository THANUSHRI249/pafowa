import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  ChevronRight,
  Clock3,
  LogOut,
  Megaphone,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { APP_NAME, APP_TAGLINE, ROLE_LABELS } from '../../lib/config'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/Misc'
import { Pill } from '../../components/ui/Badge'

function NavRow({ to, icon: Icon, title, description, tone = 'brand' }) {
  return (
    <Link
      to={to}
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-100 px-4 py-3 transition hover:border-brand-200 hover:bg-brand-50/40"
    >
      <span
        className={
          tone === 'grape'
            ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grape-50 text-grape-600'
            : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600'
        }
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1rem] font-semibold text-slate-900">{title}</span>
        <span className="block text-[0.84rem] leading-snug text-slate-500">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
    </Link>
  )
}

const QUICK_LINKS = [
  {
    to: '/admin/collections',
    icon: Wallet,
    title: 'Record or confirm payments',
    description: 'Cash pending, bank verification and receipts',
    tone: 'brand',
  },
  {
    to: '/admin/expenses',
    icon: ReceiptText,
    title: 'Daily expenses',
    description: 'Vouchers, bills and category totals',
    tone: 'grape',
  },
  {
    to: '/admin/apartments',
    icon: Building2,
    title: 'Apartment directory',
    description: 'Blocks, residents and combined units',
    tone: 'brand',
  },
]

const OVERSIGHT_LINKS = [
  {
    to: '/admin/collections',
    icon: Wallet,
    title: 'View collections',
    description: 'Payments, pending cash and receipts',
    tone: 'brand',
  },
  {
    to: '/admin/expenses',
    icon: ReceiptText,
    title: 'View expenses',
    description: 'Vouchers, bills and category totals',
    tone: 'grape',
  },
  {
    to: '/admin/apartments',
    icon: Building2,
    title: 'Apartment directory',
    description: 'Blocks, residents and combined units',
    tone: 'brand',
  },
]

export default function More() {
  const { user, isTreasurer, signOut } = useAuth()
  const navigate = useNavigate()
  const quickLinks = isTreasurer ? QUICK_LINKS : OVERSIGHT_LINKS

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <PageHeader
        title="More"
        description="Community notices, records and account settings."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={Megaphone}
              title="Community"
              description="Keep residents informed and records easy to find."
            />
            <div className="space-y-2.5">
              <NavRow
                to="/notices"
                icon={Megaphone}
                title="Announcements"
                description="Publish water, electrical and general notices"
              />
              <NavRow
                to="/history"
                icon={Clock3}
                title="Payment history"
                description="Search all payments and open receipts"
              />
              <NavRow
                to="/admin/security"
                icon={ShieldAlert}
                title="Security & alerts"
                description="Officer logins, devices and account lockdown"
                tone="grape"
              />
              <NavRow
                to="/profile"
                icon={UserRound}
                title="Profile & account"
                description="Your details, role and session"
                tone="grape"
              />
            </div>
          </Card>

          <Card>
            <CardHeader icon={ArrowRight} title="Quick actions" description="Jump straight to daily work." />
            <div className="space-y-2.5">
              {quickLinks.map((link) => (
                <NavRow key={link.to} {...link} />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={ShieldCheck} title="How records are kept safe" />
            <ul className="space-y-3 text-[0.92rem] leading-relaxed text-slate-600">
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>
                  <strong className="font-semibold text-slate-900">Residents see only their own unit.</strong>{' '}
                  Database row level security blocks access to other apartments&apos; payments.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>
                  <strong className="font-semibold text-slate-900">Every confirmation creates a receipt.</strong>{' '}
                  Receipt numbers are permanent and PDFs are generated from the saved payment.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>
                  <strong className="font-semibold text-slate-900">Financial records are never silently deleted.</strong>{' '}
                  Rejected payments keep their history and expenses are voided with a reason.
                </span>
              </li>
            </ul>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-grape-50 text-grape-600">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[1rem] font-semibold text-slate-900">{user?.full_name}</p>
                <p className="truncate text-sm text-slate-500">
                  {ROLE_LABELS[user?.role] || 'Officer'} · {user?.phone || 'Phone login'}
                </p>
              </div>
              <Pill tone="emerald">
                <ShieldCheck className="h-3.5 w-3.5" /> Live
              </Pill>
            </div>
            <Button variant="secondary" icon={LogOut} className="mt-4" fullWidth onClick={handleSignOut}>
              Sign out
            </Button>
          </Card>

          <p className="px-1 text-center text-xs leading-relaxed text-slate-400">
            {APP_NAME} · {APP_TAGLINE}
          </p>
        </div>
      </div>
    </div>
  )
}
