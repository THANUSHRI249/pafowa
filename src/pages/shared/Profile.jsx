import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Info, LogOut, Phone, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { repo } from '../../lib/data'
import { APP_NAME, APP_TAGLINE, ROLE_LABELS } from '../../lib/config'
import { residentBillingUnits } from '../../lib/billing'
import { formatDate, money } from '../../lib/utils'
import Card, { CardHeader } from '../../components/ui/Card'
import Button, { buttonClasses } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Avatar, PageHeader } from '../../components/ui/Misc'
import { Pill } from '../../components/ui/Badge'

export default function Profile() {
  const { user, isResident, isTreasurer, isReadOnlyOfficer, refresh, signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({ full_name: user?.full_name || '', phone: user?.phone || '' })
  }, [user?.id, user?.full_name, user?.phone])

  const { data: units } = useAsyncData(async () => {
    const [apartments, combined] = await Promise.all([
      repo.apartments.mine(user.id),
      repo.combined.list(),
    ])
    return residentBillingUnits(apartments, combined, user.id)
  }, [user.id])

  const save = async (event) => {
    event.preventDefault()
    if (!form.full_name.trim()) {
      setErrors({ full_name: 'Enter your name.' })
      return
    }
    setSaving(true)
    try {
      await repo.profiles.updateMe({ full_name: form.full_name.trim(), phone: form.phone.trim() })
      await refresh()
      toast.success('Your profile has been updated.')
    } catch (err) {
      toast.error(err.message || 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <PageHeader title="Profile" description="Your account and apartment details." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar name={user?.full_name} size="lg" />
              <div className="min-w-0">
                <h2 className="text-[1.3rem] font-bold text-slate-900">{user?.full_name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Pill tone={isResident ? 'brand' : 'grape'}>
                    {isResident ? <UserRound className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {ROLE_LABELS[user?.role] || 'Resident'}
                  </Pill>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                    <Phone className="h-4 w-4" />
                    {user?.phone || 'No phone number'}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={save} className="mt-6 space-y-4" noValidate>
              <Input
                label="Full name"
                name="full_name"
                value={form.full_name}
                onChange={(event) => {
                  setForm((current) => ({ ...current, full_name: event.target.value }))
                  setErrors({})
                }}
                error={errors.full_name}
                autoComplete="name"
              />
              <Input
                label="Phone number"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+91 98400 00000"
                autoComplete="tel"
                disabled
                hint="This is your login number. Ask the committee to change it."
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" loading={saving}>
                  Save changes
                </Button>
                <p className="text-sm text-slate-500">
                  Your phone number is your login. Ask the committee for any change.
                </p>
              </div>
            </form>
          </Card>

          {isResident ? (
            <Card>
              <CardHeader
                icon={Building2}
                title="My apartment"
                description="Your maintenance unit and monthly amount."
              />
              {!units?.length ? (
                <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4 text-[0.92rem] leading-relaxed text-amber-900">
                  <p className="font-semibold">Not linked yet</p>
                  <p className="mt-1">
                    Ask the treasurer to link your apartment using{' '}
                    <strong>{user?.phone}</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {units.map((unit) => (
                    <div
                      key={unit.key}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-4"
                    >
                      <div>
                        <p className="text-[1.02rem] font-semibold text-slate-900">{unit.label}</p>
                        <p className="mt-0.5 text-sm text-slate-500">{unit.resident_names}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[0.98rem] font-bold text-slate-900">
                          {money(unit.maintenance_amount)}
                        </p>
                        <p className="text-xs text-slate-500">per month</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <CardHeader
                icon={ShieldCheck}
                title={`${ROLE_LABELS[user?.role] || 'Officer'} access`}
                description={
                  isReadOnlyOfficer
                    ? 'You can review collections, expenses, apartments and security alerts. Only the treasurer can record, confirm or void records.'
                    : 'You can manage all apartments, payments, expenses, receipts, notices and officer security.'
                }
              />
              <p className="rounded-2xl bg-grape-50 p-4 text-[0.9rem] leading-relaxed text-grape-600">
                This account is protected by your password at every new app session. Signing in
                from a new device raises an alert for the treasurer, president and secretary.
              </p>
              <Link
                to="/admin/security"
                className={buttonClasses({ variant: 'secondary', className: 'mt-4' })}
              >
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                Open security &amp; alerts
              </Link>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={Info} title="Account information" />
            <dl className="space-y-3 text-[0.92rem]">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-slate-500">
                  <Phone className="h-4 w-4" /> Phone
                </dt>
                <dd className="font-semibold text-slate-900">{user?.phone || 'Not provided'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-semibold text-slate-900">{ROLE_LABELS[user?.role] || 'Resident'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Sign-in</dt>
                <dd className="font-semibold text-slate-900">
                  Phone number + password
                </dd>
              </div>
              {user?.created_at ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">Member since</dt>
                  <dd className="font-semibold text-slate-900">{formatDate(user.created_at)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card>
            <h2 className="text-[1.05rem] font-semibold text-slate-900">Session</h2>
            <p className="mt-1 text-[0.9rem] leading-relaxed text-slate-500">
              Sign out when using a shared phone or computer.
            </p>
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
