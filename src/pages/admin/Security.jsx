import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  Clock3,
  KeyRound,
  Laptop,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useSecurityOverview } from '../../hooks/useSecurityOverview'
import { repo } from '../../lib/data'
import { isValidPhone, normalisePhone, notifySecurityChanged, suggestPassword } from '../../lib/security'
import { ROLE_LABELS } from '../../lib/config'
import { formatDateTime } from '../../lib/utils'
import Button from '../../components/ui/Button'
import Card, { CardHeader } from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import { Input, Select, TextArea } from '../../components/ui/Input'
import { Avatar, InlineError, PageHeader, PageSkeleton } from '../../components/ui/Misc'
import { Pill } from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'

const EVENT_LABELS = {
  login: 'Signed in',
  new_device: 'New device sign-in',
  locked: 'Account locked',
  unlocked: 'Account unlocked',
  alert_acknowledged: 'Alert acknowledged',
  login_created: 'Login created',
  password_reset: 'Password changed',
  security_note: 'Security note',
}

const OFFICER_ROLE_OPTIONS = [
  { value: 'president', label: 'President' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
]

export default function Security() {
  const { user, isTreasurer, signOut } = useAuth()
  const toast = useToast()
  const { data, loading, error, reload } = useSecurityOverview(true)

  const [locking, setLocking] = useState(null)
  const [lockReason, setLockReason] = useState('')
  const [lockBusy, setLockBusy] = useState(false)
  const [busyId, setBusyId] = useState('')

  const [loginModal, setLoginModal] = useState({ open: false, mode: 'create', officer: null })
  const [loginForm, setLoginForm] = useState({ full_name: '', phone: '', role: 'secretary', password: '' })
  const [loginErrors, setLoginErrors] = useState({})
  const [loginSaving, setLoginSaving] = useState(false)

  if (loading && !data) return <PageSkeleton />
  if (error && !data) return <InlineError message={error.message} onRetry={reload} />

  const alerts = data?.alerts || []
  const devices = data?.devices || []
  const events = data?.events || []
  const officers = data?.officers || []
  const openAlerts = alerts.filter((alert) => !alert.acknowledged_at)
  const lockedOfficers = officers.filter((officer) => officer.security_locked)
  const officerName = (id) => officers.find((officer) => officer.id === id)?.full_name || 'Committee member'

  const acknowledge = async (alert) => {
    setBusyId(alert.id)
    try {
      await repo.security.acknowledge(alert.id)
      toast.success('Alert acknowledged. The banner will clear for everyone.')
      notifySecurityChanged()
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not acknowledge the alert.')
    } finally {
      setBusyId('')
    }
  }

  const confirmLock = async () => {
    if (!locking) return
    setLockBusy(true)
    try {
      await repo.security.lockOfficer(locking.id, lockReason)
      const lockedSelf = locking.id === user?.id
      setLocking(null)
      setLockReason('')
      toast.success(`${locking.full_name} is locked. The committee has been alerted.`)
      notifySecurityChanged()
      if (lockedSelf) await signOut()
      else reload()
    } catch (err) {
      toast.error(err.message || 'Could not lock the account.')
    } finally {
      setLockBusy(false)
    }
  }

  const unlock = async (officer) => {
    setBusyId(officer.id)
    try {
      await repo.security.unlockOfficer(officer.id)
      toast.success(`${officer.full_name} can sign in again.`)
      notifySecurityChanged()
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not unlock the account.')
    } finally {
      setBusyId('')
    }
  }

  const openAddOfficer = () => {
    setLoginForm({ full_name: '', phone: '', role: 'secretary', password: suggestPassword() })
    setLoginErrors({})
    setLoginModal({ open: true, mode: 'create', officer: null })
  }

  const openResetOfficer = (officer) => {
    setLoginForm({
      full_name: officer.full_name || '',
      phone: officer.phone || '',
      role: officer.role,
      password: suggestPassword(),
    })
    setLoginErrors({})
    setLoginModal({ open: true, mode: 'reset', officer })
  }

  const saveOfficerLogin = async (event) => {
    event.preventDefault()
    const next = {}
    const normalised = normalisePhone(loginForm.phone)
    if (loginModal.mode === 'create') {
      if (!loginForm.full_name.trim()) next.full_name = 'Enter the officer name.'
      if (!isValidPhone(normalised)) next.phone = 'Enter a complete phone number.'
      if (!OFFICER_ROLE_OPTIONS.some((option) => option.value === loginForm.role)) {
        next.role = 'Choose a role.'
      }
    }
    if (loginForm.password.trim().length < 8) next.password = 'Use at least 8 characters.'
    setLoginErrors(next)
    if (Object.keys(next).length) return

    setLoginSaving(true)
    try {
      if (loginModal.mode === 'create') {
        await repo.profiles.createOfficerLogin({
          fullName: loginForm.full_name,
          phone: normalised,
          password: loginForm.password,
          role: loginForm.role,
        })
        toast.success(`Login created for ${normalised}. Hand them the password.`)
      } else {
        await repo.profiles.resetPassword(loginModal.officer.id, loginForm.password)
        toast.success('Password changed. Hand the new password to the officer.')
      }
      setLoginModal({ open: false, mode: 'create', officer: null })
      notifySecurityChanged()
      reload()
    } catch (err) {
      setLoginErrors({ form: err.message })
    } finally {
      setLoginSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Security & alerts"
        description="A sign-in from a new device, or a locked account, raises an alarm for the treasurer, president and secretary."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-rose-50 p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-rose-700">Open alerts</p>
          <p className="mt-1 text-[1.35rem] font-bold text-rose-800">{openAlerts.length}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-600">Locked accounts</p>
          <p className="mt-1 text-[1.35rem] font-bold text-slate-800">{lockedOfficers.length}</p>
        </div>
        <div className="rounded-2xl bg-brand-50 p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-brand-700">Officers</p>
          <p className="mt-1 text-[1.35rem] font-bold text-brand-800">{officers.length}</p>
        </div>
        <div className="rounded-2xl bg-grape-50 p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-grape-600">Known devices</p>
          <p className="mt-1 text-[1.35rem] font-bold text-grape-600">{devices.length}</p>
        </div>
      </div>

      {!isTreasurer ? (
        <div className="mb-5 rounded-2xl bg-brand-50 p-4 text-[0.9rem] leading-relaxed text-brand-800">
          You have read-only oversight. You can lock a suspicious account immediately, but only the
          treasurer can unlock it, add committee logins or reset passwords.
        </div>
      ) : null}

      <Card className="mb-5">
        <CardHeader
          icon={ShieldAlert}
          title="Alerts"
          description="New-device sign-ins and lockdowns stay here until a committee member acknowledges them."
        />
        {alerts.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No security alerts"
            description="No unexpected committee sign-ins have been recorded."
            tone="emerald"
          />
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={
                  alert.acknowledged_at
                    ? 'rounded-2xl border border-slate-100 bg-white p-4 opacity-75'
                    : alert.severity === 'critical'
                      ? 'rounded-2xl border border-rose-200 bg-rose-50 p-4'
                      : 'rounded-2xl border border-amber-200 bg-amber-50 p-4'
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={
                        alert.severity === 'critical'
                          ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700'
                          : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700'
                      }
                    >
                      {alert.severity === 'critical' ? (
                        <ShieldAlert className="h-5 w-5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[1rem] font-semibold text-slate-900">{alert.title}</h3>
                        <Pill tone={alert.severity === 'critical' ? 'rose' : 'amber'}>
                          {alert.severity === 'critical' ? 'Critical' : 'Warning'}
                        </Pill>
                        {alert.acknowledged_at ? <Pill tone="emerald">Acknowledged</Pill> : null}
                      </div>
                      <p className="mt-1 text-[0.92rem] leading-relaxed text-slate-700">{alert.message}</p>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {officerName(alert.actor_id)} · {formatDateTime(alert.created_at)}
                        {alert.device_hash ? ` · Device ${alert.device_hash.slice(0, 10)}` : ''}
                      </p>
                      {alert.acknowledged_at ? (
                        <p className="mt-1 text-xs text-emerald-700">
                          Acknowledged by {officerName(alert.acknowledged_by)} on{' '}
                          {formatDateTime(alert.acknowledged_at)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {!alert.acknowledged_at ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={Check}
                      loading={busyId === alert.id}
                      onClick={() => acknowledge(alert)}
                    >
                      Acknowledge
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={KeyRound}
            title="Committee accounts"
            description="Treasurer, president and secretary — each signs in with their own phone number."
            action={
              isTreasurer ? (
                <Button size="sm" icon={UserPlus} onClick={openAddOfficer}>
                  Add
                </Button>
              ) : null
            }
          />
          <div className="space-y-2.5">
            {officers.map((officer) => (
              <div key={officer.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={officer.full_name} />
                    <div className="min-w-0">
                      <p className="text-[1rem] font-semibold text-slate-900">
                        {officer.full_name}
                        {officer.id === user?.id ? (
                          <span className="ml-2 text-xs font-medium text-slate-500">You</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        {ROLE_LABELS[officer.role] || officer.role}
                        {officer.phone ? ` · ${officer.phone}` : officer.email ? ` · ${officer.email}` : ''}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        Last sign-in {formatDateTime(officer.last_login_at)}
                      </p>
                      {officer.security_locked && officer.security_locked_reason ? (
                        <p className="mt-1 text-xs text-rose-700">{officer.security_locked_reason}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Pill tone={officer.security_locked ? 'rose' : 'emerald'}>
                      {officer.security_locked ? <Lock className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      {officer.security_locked ? 'Locked' : 'Protected'}
                    </Pill>
                    {isTreasurer ? (
                      <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => openResetOfficer(officer)}>
                        Reset password
                      </Button>
                    ) : null}
                    {!officer.security_locked ? (
                      <Button size="sm" variant="danger" icon={Lock} onClick={() => setLocking(officer)}>
                        Lock
                      </Button>
                    ) : isTreasurer ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Unlock}
                        loading={busyId === officer.id}
                        onClick={() => unlock(officer)}
                      >
                        Unlock
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={Laptop} title="Known devices" description="Every device an officer has signed in from." />
            {devices.length === 0 ? (
              <EmptyState
                icon={Laptop}
                title="No devices yet"
                description="Devices appear here after the first committee sign-in."
                tone="slate"
              />
            ) : (
              <div className="space-y-2.5">
                {devices.map((device) => (
                  <div key={device.id} className="rounded-2xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.94rem] font-semibold text-slate-900">
                        {officerName(device.officer_id)}
                      </p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.68rem] font-semibold text-slate-500">
                        {String(device.device_hash).slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{device.platform || 'Unknown device'}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      First seen {formatDateTime(device.first_seen_at)} · Last seen{' '}
                      {formatDateTime(device.last_seen_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader icon={Users} title="Recent activity" description="The last security events." />
            {events.length === 0 ? (
              <EmptyState
                icon={Clock3}
                title="Nothing yet"
                description="Logins, device changes and lock actions are recorded here."
                tone="slate"
              />
            ) : (
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[0.9rem] font-semibold text-slate-800">
                        {EVENT_LABELS[event.event_type] || event.event_type}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {officerName(event.actor_id)} · {event.detail}
                      </p>
                    </div>
                    <p className="shrink-0 text-[0.72rem] text-slate-400">
                      {formatDateTime(event.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={loginModal.open}
        onClose={() => {
          if (!loginSaving) setLoginModal({ open: false, mode: 'create', officer: null })
        }}
        title={loginModal.mode === 'create' ? 'Add a committee member' : 'Reset officer password'}
        description={
          loginModal.mode === 'create'
            ? 'They sign in with this phone number and password, just like residents.'
            : 'The old password stops working immediately.'
        }
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setLoginModal({ open: false, mode: 'create', officer: null })}
              disabled={loginSaving}
            >
              Cancel
            </Button>
            <Button type="submit" form="committee-login-form" icon={KeyRound} loading={loginSaving}>
              {loginModal.mode === 'create' ? 'Create login' : 'Save new password'}
            </Button>
          </div>
        }
      >
        <form id="committee-login-form" onSubmit={saveOfficerLogin} className="space-y-4" noValidate>
          {loginErrors.form ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {loginErrors.form}
            </div>
          ) : null}
          {loginModal.mode === 'create' ? (
            <>
              <Input
                label="Name"
                name="officer_full_name"
                placeholder="Full name"
                value={loginForm.full_name}
                onChange={(event) => {
                  setLoginForm((current) => ({ ...current, full_name: event.target.value }))
                  setLoginErrors((current) => ({ ...current, full_name: undefined }))
                }}
                error={loginErrors.full_name}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Sign-in phone"
                  name="officer_phone"
                  type="tel"
                  placeholder="+91 98400 00000"
                  value={loginForm.phone}
                  onChange={(event) => {
                    setLoginForm((current) => ({ ...current, phone: event.target.value }))
                    setLoginErrors((current) => ({ ...current, phone: undefined }))
                  }}
                  error={loginErrors.phone}
                />
                <Select
                  label="Role"
                  name="officer_role"
                  options={OFFICER_ROLE_OPTIONS}
                  value={loginForm.role}
                  onChange={(event) => {
                    setLoginForm((current) => ({ ...current, role: event.target.value }))
                    setLoginErrors((current) => ({ ...current, role: undefined }))
                  }}
                  error={loginErrors.role}
                />
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {loginModal.officer?.full_name} · {ROLE_LABELS[loginModal.officer?.role] || loginModal.officer?.role}
              {loginModal.officer?.phone ? ` · ${loginModal.officer.phone}` : ''}
            </div>
          )}
          <div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  label="Password"
                  name="officer_password"
                  type="text"
                  autoComplete="new-password"
                  className="font-mono"
                  value={loginForm.password}
                  onChange={(event) => {
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                    setLoginErrors((current) => ({ ...current, password: undefined }))
                  }}
                  error={loginErrors.password}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setLoginForm((current) => ({ ...current, password: suggestPassword() }))}
              >
                New
              </Button>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              At least 8 characters. Write it down before saving — they will need it to open the app.
            </p>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(locking)}
        onClose={() => {
          if (!lockBusy) {
            setLocking(null)
            setLockReason('')
          }
        }}
        title="Lock this account?"
        description={
          locking
            ? `${locking.full_name} (${ROLE_LABELS[locking.role] || locking.role}) will lose all access immediately. The committee will see a critical alert.`
            : ''
        }
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setLocking(null)
                setLockReason('')
              }}
              disabled={lockBusy}
            >
              Cancel
            </Button>
            <Button variant="danger" icon={Lock} onClick={confirmLock} loading={lockBusy}>
              Lock account
            </Button>
          </div>
        }
      >
        <TextArea
          label="Reason"
          name="lockReason"
          rows={3}
          placeholder="e.g. Sign-in from an unknown device in another city"
          value={lockReason}
          onChange={(event) => setLockReason(event.target.value)}
          hint="Shown to the other officers on the lockdown alert."
        />
        {locking?.id === user?.id ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
            You are locking your own account. You will be signed out.
          </p>
        ) : null}
      </Modal>
    </div>
  )
}
