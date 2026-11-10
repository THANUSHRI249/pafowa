import { useState } from 'react'
import { KeyRound, LogOut, ScanLine, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../lib/config'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { Input } from '../ui/Input'

function BrandMark() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] gpay-gradient text-white shadow-float">
        <ShieldCheck className="h-8 w-8" />
      </span>
      <h1 className="mt-4 text-[1.5rem] font-extrabold tracking-tight text-slate-900">PAFOWA</h1>
      <p className="mt-1 text-[0.92rem] text-slate-500">Committee account protection</p>
    </div>
  )
}

export default function MfaGate() {
  const { user, mfa, status, verifyMfa, cancelEnrollment, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const enrolling = status === 'mfa-enroll'
  const enrollment = mfa?.enrollment
  const roleLabel = ROLE_LABELS[user?.role] || 'Committee member'

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setBusy(true)
    try {
      await verifyMfa(code.trim())
      setCode('')
    } catch (err) {
      setError(err.message || 'Could not verify that code.')
    } finally {
      setBusy(false)
    }
  }

  const leave = async () => {
    if (enrolling) await cancelEnrollment()
    else await signOut()
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[27rem]">
        <BrandMark />

        <Card className="mt-7 !rounded-[1.75rem] p-6 sm:p-8">
          {enrolling ? (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <ScanLine className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-[1.15rem] font-bold text-slate-900">Set up your authenticator</h2>
                  <p className="text-[0.88rem] text-slate-500">One-time setup for {user?.full_name}</p>
                </div>
              </div>

              <ol className="mt-5 space-y-2 text-[0.92rem] leading-relaxed text-slate-600">
                <li>1. Install Google Authenticator, Microsoft Authenticator or Authy.</li>
                <li>2. Scan the QR code below, or enter the setup key manually.</li>
                <li>3. Enter the 6-digit code the app shows.</li>
              </ol>

              {enrollment?.qrCode ? (
                <img
                  src={enrollment.qrCode}
                  alt="Authenticator setup QR code"
                  className="mx-auto mt-5 h-44 w-44 rounded-2xl border border-slate-100 bg-white p-2"
                />
              ) : null}

              {enrollment?.secret ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-center">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                    Setup key
                  </p>
                  <p className="mt-1 break-all font-mono text-[0.92rem] font-semibold text-slate-800">
                    {enrollment.secret}
                  </p>
                </div>
              ) : null}

            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-grape-50 text-grape-600">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-[1.15rem] font-bold text-slate-900">Enter your authenticator code</h2>
                  <p className="text-[0.88rem] text-slate-500">
                    {user?.full_name} · {roleLabel}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[0.92rem] leading-relaxed text-slate-600">
                A password alone cannot open this account. Enter the current 6-digit code from your
                authenticator app to continue.
              </p>
            </>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <Input
              label="6-digit code"
              name="mfaCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                setError('')
              }}
              error={error}
              className="text-center font-mono text-[1.3rem] tracking-[0.5em]"
              autoFocus
            />
            <Button type="submit" fullWidth loading={busy}>
              Verify and continue
            </Button>
          </form>

          <button
            type="button"
            onClick={leave}
            className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <LogOut className="h-4 w-4" />
            {enrolling ? 'Cancel setup' : 'Sign out and use another account'}
          </button>
        </Card>

        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
          Every committee sign-in from a new device raises an alert for the treasurer, president and
          secretary.
        </p>
      </div>
    </div>
  )
}
