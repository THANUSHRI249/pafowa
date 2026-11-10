import {
  Building2,
  Clock3,
  Home,
  LayoutDashboard,
  Megaphone,
  Menu,
  ReceiptText,
  ShieldAlert,
  UserRound,
  Wallet,
} from 'lucide-react'
import { isOfficerRole } from '../../lib/security'

export const residentNav = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/maintenance', label: 'Maintenance', icon: Wallet },
  { to: '/history', label: 'History', icon: Clock3 },
  { to: '/notices', label: 'Notices', icon: Megaphone },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export const treasurerNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/collections', label: 'Maintenance', icon: Wallet },
  { to: '/admin/expenses', label: 'Expenses', icon: ReceiptText },
  { to: '/admin/apartments', label: 'Apartments', icon: Building2 },
  { to: '/admin/more', label: 'More', icon: Menu },
]

export const securityNavItem = { to: '/admin/security', label: 'Security', icon: ShieldAlert }

export function navForRole(role) {
  return isOfficerRole(role) ? treasurerNav : residentNav
}
