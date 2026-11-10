import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { APP_NAME, APP_TAGLINE, ROLE_LABELS } from '../../lib/config'
import { cn } from '../../lib/utils'
import { Avatar } from '../ui/Misc'
import SecurityBanner from '../security/SecurityBanner'
import { navForRole, securityNavItem, treasurerNav } from './nav'

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl gpay-gradient text-white shadow-float">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
          <path
            d="M4 20V10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-[1.2rem] font-extrabold leading-none tracking-tight text-slate-900">
          {APP_NAME}
        </p>
        <p className={cn('mt-1 truncate text-[0.72rem] leading-tight text-slate-500', compact && 'hidden')}>
          {APP_TAGLINE}
        </p>
      </div>
    </div>
  )
}

function NavItems({ items, onNavigate }) {
  return (
    <nav className="space-y-1.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-h-13 items-center gap-3 rounded-2xl px-4 py-3 text-[1rem] font-medium transition',
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('h-[1.4rem] w-[1.4rem]', isActive ? 'text-brand-600' : 'text-slate-400')} />
              <span>{item.label}</span>
              {isActive ? <span className="ml-auto h-2 w-2 rounded-full bg-brand-500" /> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function Sidebar() {
  const { user, isOfficer, signOut } = useAuth()
  const navigate = useNavigate()
  const items = isOfficer ? [...treasurerNav, securityNavItem] : navForRole(user?.role)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col border-r border-slate-100 bg-white px-5 py-6 lg:flex">
      <NavLink to="/" className="px-1">
        <Brand />
      </NavLink>

      <div className="mt-9 flex-1">
        <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Menu</p>
        <NavItems items={items} />
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl bg-emerald-50 p-3.5 text-[0.8rem] leading-snug text-emerald-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-4 w-4" /> Connected
          </p>
          <p className="mt-1 text-emerald-700">Supabase secure records</p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
          <Avatar name={user?.full_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.92rem] font-semibold text-slate-800">{user?.full_name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[user?.role] || 'Resident'}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function MobileHeader() {
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <NavLink to="/" aria-label="PAFOWA home">
          <Brand compact />
        </NavLink>
        <NavLink
          to="/profile"
          className="flex min-h-11 items-center gap-2 rounded-full border border-slate-100 bg-white px-2.5 py-1.5"
          aria-label="Open profile"
        >
          <Avatar name={user?.full_name} size="sm" />
          <span className="max-w-[7.5rem] truncate pr-1 text-sm font-semibold text-slate-700">
            {String(user?.full_name || '').split(' ')[0]}
          </span>
        </NavLink>
      </div>
    </header>
  )
}

function BottomNav() {
  const { user } = useAuth()
  const items = navForRole(user?.role)
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/97 backdrop-blur lg:hidden"
      aria-label="Main navigation"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 transition',
                isActive ? 'text-brand-700' : 'text-slate-500',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition',
                    isActive && 'bg-brand-50',
                  )}
                >
                  <item.icon className={cn('h-[1.4rem] w-[1.4rem]', isActive && 'text-brand-600')} />
                </span>
                <span className={cn('text-[0.7rem] leading-none', isActive ? 'font-bold' : 'font-medium')}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default function AppShell() {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <MobileHeader />
      <main className="lg:pl-[17.5rem]">
        <div className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-9">
          <SecurityBanner />
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
