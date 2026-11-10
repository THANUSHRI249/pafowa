import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ArrowLeft,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { APP_SHORT_TAGLINE, APP_TAGLINE } from '../lib/config'
import { isEmail } from '../lib/utils'
import { normalisePhone } from '../lib/security'
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
  const { user, notice, signIn, sendOtp, verifyOtp } = useAuth()

  const [tab, setTab] = useState('resident')
  const [residentStep, setResidentStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [sentPhone, setSentPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [otpError, setOtpError] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  if (user) return <Navigate to="/" replace />

  const noticeText =
    notice === 'resident'
      ? 'For your security, verify your phone number again to open the app.'
      : notice === 'officer'
        ? 'Your committee session has ended. Sign in again with your password and authenticator code.'
        : ''

  const clearMessages = () => {
    setFormError('')
    setOtpError('')
  }

  const switchTab = (next) => {
    setTab(next)
    clearMessages()
    setErrors({})
  }

  const sendCode = async (value) => {
    const normalised = normalisePhone(value)
    if (!normalised) {
      setOtpError('Enter your phone number.')
      return
    }
    clearMessages()
    setLoading(true)
    try {
      const result = await sendOtp(value)
      setSentPhone(result?.phone || normalised)
      setResidentStep('code')
      setOtp('')
      setResendIn(30)
    } catch (error) {
      setOtpError(error.message || 'Could not send the SMS code.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendCode = async (event) => {
    event.preventDefault()
    await sendCode(phone)
  }

  const handleVerify = async (event) => {
    event.preventDefault()
    clearMessages()
    if (!/^\d{6}$/.test(otp.trim())) {
      setOtpError('Enter the 6-digit code from the SMS.')
      return
    }
    setLoading(true)
    try {
      await verifyOtp(sentPhone || phone, otp.trim())
    } catch (error) {
      setOtpError(error.message || 'Could not verify that code.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (resendIn > 0) return
    await sendCode(sentPhone || phone)
  }

  const handleCommittee = async (event) => {
    event.preventDefault()
    clearMessages()
    const next = {}
    if (!isEmail(email)) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    if (Object.keys(next).length) return

    setLoading(true)
    try {
      await signIn(email, password)
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

          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="Sign-in type">
            {[
              { key: 'resident', label: 'Resident', icon: UserRound },
              { key: 'committee', label: 'Committee', icon: BriefcaseBusiness },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => switchTab(item.key)}
                className={
                  tab === item.key
                    ? 'flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white text-[0.95rem] font-semibold text-slate-900 shadow-sm'
                    : 'flex min-h-11 items-center justify-center gap-2 rounded-xl text-[0.95rem] font-medium text-slate-500 transition hover:text-slate-700'
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'resident' ? (
            residentStep === 'phone' ? (
              <form onSubmit={handleSendCode} className="mt-6 space-y-4" noValidate>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-50 p-3.5 text-[0.88rem] leading-relaxed text-brand-800">
                  <Smartphone className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>
                    Residents sign in with a one-time SMS code. Enter the mobile number registered with
                    the association.
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
                    setOtpError('')
                  }}
                  error={otpError}
                  autoFocus
                />
                <Button type="submit" fullWidth loading={loading} icon={Smartphone}>
                  Send SMS code
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="mt-6 space-y-4" noValidate>
                <button
                  type="button"
                  onClick={() => {
                    setResidentStep('phone')
                    setOtp('')
                    setOtpError('')
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  <ArrowLeft className="h-4 w-4" /> Change number
                </button>
                <div className="rounded-2xl bg-slate-50 p-3.5 text-[0.9rem] leading-relaxed text-slate-600">
                  We sent a 6-digit code to{' '}
                  <strong className="text-slate-900">{sentPhone || phone}</strong>.
                </div>
                <Input
                  label="SMS code"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(event) => {
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                    setOtpError('')
                  }}
                  error={otpError}
                  className="text-center font-mono text-[1.3rem] tracking-[0.5em]"
                  autoFocus
                />
                <Button type="submit" fullWidth loading={loading}>
                  Verify and open app
                </Button>
                <button
                  type="button"
                  onClick={resend}
                  disabled={resendIn > 0 || loading}
                  className="flex min-h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend SMS code'}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleCommittee} className="mt-6 space-y-4" noValidate>
              <div className="flex items-start gap-3 rounded-2xl bg-grape-50 p-3.5 text-[0.88rem] leading-relaxed text-grape-600">
                <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Treasurer, president and secretary only. After your password you must enter the
                  6-digit code from your authenticator app.
                </p>
              </div>
              <Input
                label="Email address"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setErrors((current) => ({ ...current, email: undefined }))
                  setFormError('')
                }}
                error={errors.email}
                autoFocus
              />
              <div className="relative">
                <Input
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
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
              <Button type="submit" fullWidth loading={loading} icon={ShieldCheck}>
                Continue to verification
              </Button>
              <p className="text-center text-[0.82rem] leading-relaxed text-slate-500">
                Committee accounts are created by the association. Ask the treasurer if you need access.
              </p>
            </form>
          )}

        </Card>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs leading-relaxed text-slate-500">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          SMS codes for residents · authenticator codes for committee accounts
        </p>
      </div>
    </div>
  )
}
