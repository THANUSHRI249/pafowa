import { LogOut, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../lib/config'
import Button from '../ui/Button'
import Card from '../ui/Card'

export default function LockedScreen() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[26rem]">
        <Card className="!rounded-[1.75rem] border-rose-100 p-6 sm:p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ShieldAlert className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-[1.3rem] font-bold text-slate-900">This account is locked</h1>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-600">
            The committee locked the {ROLE_LABELS[user?.role]?.toLowerCase() || 'committee'} account
            {user?.full_name ? ` for ${user.full_name}` : ''} after a security alert. No records can be
            viewed or changed from this sign-in.
          </p>

          {user?.security_locked_reason ? (
            <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-[0.9rem] leading-relaxed text-rose-900">
              <span className="font-semibold">Reason:</span> {user.security_locked_reason}
            </p>
          ) : null}

          <p className="mt-4 text-[0.9rem] leading-relaxed text-slate-500">
            Ask the treasurer to unlock the account from the Security page once the sign-in has been
            checked. If you locked it yourself, the treasurer can restore it.
          </p>

          <Button variant="secondary" icon={LogOut} fullWidth className="mt-5" onClick={signOut}>
            Sign out
          </Button>
        </Card>
      </div>
    </div>
  )
}
