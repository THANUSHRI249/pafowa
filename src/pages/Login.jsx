import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, ShieldCheck, Smartphone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { APP_SHORT_TAGLINE, APP_TAGLINE } from '../lib/config'
import { isValidPhone, normalisePhone } from '../lib/security'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { Input } from '../components/ui/Input'

function BrandMark() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-[4.4rem] w-[4.4rem] items-center justify-center rounded-[1.4rem] gpay-gradient text-white shadow-float">
        <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" aria-hidden="true">
          <path
            d="M4 20V10.5L12 4l8 6.5V20h-5.5v-6h-5v6H4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h1 className="mt-4 text-[2rem] font-extrabold leading-none tracking-tight text-slate-900">PAFOWA</h1>
      <p className="mt-2 max-w-sm text-[0.98rem] font-medium leading-snug text-slate-500">{APP_TAGLINE}</p>
      <p className="mt-1 text-[0.92rem] text-slate-400">{APP_SHORT_TAGLINE}</p>
    </div>
  )
}

export default function Login() {
  const { user, notice, signIn } = useAuth()

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  const noticeText =
    notice === 'session'
      ? 'For your security, sign in again with your phone number and password.'
      : ''

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')
    const normalised = normalisePhone(phone)
    const next = {}
    if (!normalised) next.phone = 'Enter your phone number.'
    else if (!isValidPhone(normalised)) next.phone = 'Enter a complete phone number, e.g. +91 98400 00000.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    try {
      await signIn(normalised, password)
    } catch (error) {
      setFormError(error.message || 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas px-4 py-10 sm:py-14">
      <div
        className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-brand-100/50 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-grape-100/40 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-[28rem]">
        <BrandMark />

        <Card className="mt-8 !rounded-[1.75rem] p-5 sm:p-7">
          {noticeText ? (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-3.5 py-3 text-[0.9rem] leading-relaxed text-amber-900">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{noticeText}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-3.5 text-[0.88rem] leading-relaxed text-brand-800">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Sign in with your phone number and the password given to you by the committee.
                Forgotten your password? Ask the treasurer to reset it.
              </p>
            </div>
            <Input
              label="Phone number"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98400 00000"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
                setErrors((current) => ({ ...current, phone: undefined }))
                setFormError('')
              }}
              error={errors.phone}
              autoFocus
            />
            <div className="relative">
              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter the password from the committee"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setErrors((current) => ({ ...current, password: undefined }))
                  setFormError('')
                }}
                error={errors.password}
                className="pr-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute bottom-0 right-0 flex h-14 w-14 items-center justify-center rounded-2xl text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {formError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[0.92rem] text-rose-800" role="alert">
                {formError}
              </div>
            ) : null}
            <Button type="submit" fullWidth loading={loading} icon={KeyRound}>
              Open app
            </Button>
          </form>
        </Card>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          One login for everyone · phone number + password issued by the committee
        </p>
      </div>
    </div>
  )
}
