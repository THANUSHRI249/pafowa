import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppShell from './components/layout/AppShell'
import MfaGate from './components/auth/MfaGate'
import LockedScreen from './components/auth/LockedScreen'
import Login from './pages/Login'
import ResidentHome from './pages/resident/Home'
import Maintenance from './pages/resident/Maintenance'
import History from './pages/shared/History'
import Notices from './pages/shared/Notices'
import Profile from './pages/shared/Profile'
import TreasurerDashboard from './pages/admin/Dashboard'
import Collections from './pages/admin/Collections'
import Expenses from './pages/admin/Expenses'
import Apartments from './pages/admin/Apartments'
import More from './pages/admin/More'
import Security from './pages/admin/Security'

function StartupScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-canvas px-6">
      <span className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] gpay-gradient text-white shadow-float">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
          <path
            d="M4 20V10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4Z"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="text-center">
        <p className="text-lg font-bold tracking-tight text-slate-900">PAFOWA</p>
        <p className="mt-1 text-[0.92rem] text-slate-500">Loading your association…</p>
      </div>
      <span className="h-1 w-24 overflow-hidden rounded-full bg-slate-200">
        <span className="block h-full w-1/2 animate-pulse rounded-full gpay-gradient" />
      </span>
    </div>
  )
}

function RequireAuth() {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <StartupScreen />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function RequireOfficer() {
  const { isOfficer } = useAuth()
  if (!isOfficer) return <Navigate to="/" replace />
  return <Outlet />
}

function RoleHome() {
  const { isOfficer } = useAuth()
  return isOfficer ? <TreasurerDashboard /> : <ResidentHome />
}

function AuthGate({ children }) {
  const { status } = useAuth()

  if (status === 'loading') return <StartupScreen />
  if (status === 'locked') return <LockedScreen />
  if (status === 'mfa-challenge' || status === 'mfa-enroll') return <MfaGate />
  return children
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <AuthGate>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<RoleHome />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="history" element={<History />} />
              <Route path="notices" element={<Notices />} />
              <Route path="profile" element={<Profile />} />

              <Route path="admin" element={<RequireOfficer />}>
                <Route path="collections" element={<Collections />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="apartments" element={<Apartments />} />
                <Route path="security" element={<Security />} />
                <Route path="more" element={<More />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGate>
    </>
  )
}
