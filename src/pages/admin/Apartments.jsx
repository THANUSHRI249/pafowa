import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Check,
  KeyRound,
  Layers,
  Link2,
  Pencil,
  Plus,
  Search,
  Split,
  Unlink,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { repo } from '../../lib/data'
import { OCCUPANCY_OPTIONS } from '../../lib/config'
import { isValidPhone, normalisePhone, suggestPassword } from '../../lib/security'
import { cn, formatDate, money } from '../../lib/utils'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import { Checkbox, Input, Select, TextArea } from '../../components/ui/Input'
import { Pill } from '../../components/ui/Badge'
import { ConfirmDialog, InlineError, PageHeader, PageSkeleton } from '../../components/ui/Misc'
import EmptyState from '../../components/ui/EmptyState'

const EMPTY_APARTMENT = {
  block: '',
  unit_number: '',
  display_label: '',
  resident_name: '',
  contact_phone: '',
  occupancy_status: 'owner',
  maintenance_amount: '2500',
  user_id: '',
  is_active: true,
}

const OCCUPANCY_LABELS = Object.fromEntries(OCCUPANCY_OPTIONS.map((item) => [item.value, item.label]))

function labelOf(apartment) {
  return apartment.display_label || `${apartment.block}${apartment.unit_number}`
}

export default function Apartments() {
  const { isTreasurer } = useAuth()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [blockFilter, setBlockFilter] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [aptModal, setAptModal] = useState({ open: false, apartment: null })
  const [aptForm, setAptForm] = useState(EMPTY_APARTMENT)
  const [aptErrors, setAptErrors] = useState({})
  const [aptSaving, setAptSaving] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockForm, setBlockForm] = useState({ block: '', count: '6', start: '1', amount: '2500' })
  const [blockSaving, setBlockSaving] = useState(false)
  const [combinedModal, setCombinedModal] = useState({ open: false, group: null, locked: false })
  const [combinedForm, setCombinedForm] = useState({ name: '', maintenance_amount: '', notes: '', apartment_ids: [] })
  const [combinedSearch, setCombinedSearch] = useState('')
  const [combinedErrors, setCombinedErrors] = useState({})
  const [combinedSaving, setCombinedSaving] = useState(false)
  const [loginModal, setLoginModal] = useState({ open: false, mode: 'create', resident: null })
  const [loginForm, setLoginForm] = useState({ full_name: '', phone: '', password: '' })
  const [loginErrors, setLoginErrors] = useState({})
  const [loginSaving, setLoginSaving] = useState(false)
  const [separateTarget, setSeparateTarget] = useState(null)
  const [separating, setSeparating] = useState(false)

  const { data, loading, error, reload } = useAsyncData(async () => {
    const [apartments, combined, residents, payments] = await Promise.all([
      repo.apartments.list({ includeArchived: true }),
      repo.combined.list(),
      repo.profiles.listResidents(),
      repo.payments.list({}),
    ])
    return { apartments, combined, residents, payments }
  }, [])

  const apartments = data?.apartments || []
  const combined = data?.combined || []
  const residents = data?.residents || []
  const payments = data?.payments || []

  const residentById = useMemo(() => new Map(residents.map((r) => [r.id, r])), [residents])
  const linkedLogin = aptForm.user_id ? residentById.get(aptForm.user_id) : null

  const blocks = useMemo(
    () => [...new Set(apartments.map((apartment) => apartment.block))].sort(),
    [apartments],
  )

  const groupedMap = useMemo(() => {
    const map = new Map()
    combined
      .filter((group) => group.is_active)
      .forEach((group) => {
        ;(group.apartment_ids || []).forEach((id) => map.set(id, group))
      })
    return map
  }, [combined])

  const filteredApartments = useMemo(() => {
    const query = search.trim().toLowerCase()
    return apartments.filter((apartment) => {
      if (!showArchived && !apartment.is_active) return false
      if (blockFilter !== 'all' && apartment.block !== blockFilter) return false
      if (!query) return true
      return [labelOf(apartment), apartment.resident_name, apartment.contact_phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [apartments, blockFilter, search, showArchived])

  const groupedByBlock = useMemo(() => {
    const map = new Map()
    filteredApartments.forEach((apartment) => {
      if (!map.has(apartment.block)) map.set(apartment.block, [])
      map.get(apartment.block).push(apartment)
    })
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filteredApartments])

  const activeCombined = combined.filter((group) => group.is_active)
  const inactiveCombined = combined.filter((group) => !group.is_active)

  const openAddApartment = () => {
    setAptForm({
      ...EMPTY_APARTMENT,
      block: blockFilter !== 'all' ? blockFilter : blocks[0] || '',
    })
    setAptErrors({})
    setAptModal({ open: true, apartment: null })
  }

  const openEditApartment = (apartment) => {
    setAptForm({
      block: apartment.block || '',
      unit_number: apartment.unit_number || '',
      display_label: apartment.display_label || '',
      resident_name: apartment.resident_name || '',
      contact_phone: apartment.contact_phone || '',
      occupancy_status: apartment.occupancy_status || 'owner',
      maintenance_amount: String(apartment.maintenance_amount ?? ''),
      user_id: apartment.user_id || '',
      is_active: apartment.is_active !== false,
    })
    setAptErrors({})
    setAptModal({ open: true, apartment })
  }

  const setAptValue = (key, value) => {
    setAptForm((current) => ({ ...current, [key]: value }))
    setAptErrors((current) => ({ ...current, [key]: undefined }))
  }

  const saveApartment = async (event) => {
    event.preventDefault()
    const next = {}
    if (!aptForm.block.trim()) next.block = 'Enter the block name.'
    if (!aptForm.unit_number.trim()) next.unit_number = 'Enter the apartment number.'
    if (!(Number(aptForm.maintenance_amount) >= 0)) next.maintenance_amount = 'Enter the monthly amount.'
    setAptErrors(next)
    if (Object.keys(next).length) return
    setAptSaving(true)
    try {
      const payload = {
        ...aptForm,
        maintenance_amount: Number(aptForm.maintenance_amount) || 0,
        user_id: aptForm.user_id || null,
      }
      if (aptModal.apartment) {
        await repo.apartments.update(aptModal.apartment.id, payload)
        toast.success('Apartment updated.')
      } else {
        await repo.apartments.create(payload)
        toast.success('Apartment added to the directory.')
      }
      setAptModal({ open: false, apartment: null })
      reload()
    } catch (err) {
      setAptErrors({ form: err.message })
    } finally {
      setAptSaving(false)
    }
  }

  const openCreateLogin = () => {
    setLoginForm({
      full_name: aptForm.resident_name || '',
      phone: aptForm.contact_phone || '',
      password: suggestPassword(),
    })
    setLoginErrors({})
    setLoginModal({ open: true, mode: 'create', resident: null })
  }

  const openResetLogin = (resident) => {
    setLoginForm({ full_name: resident.full_name || '', phone: resident.phone || '', password: suggestPassword() })
    setLoginErrors({})
    setLoginModal({ open: true, mode: 'reset', resident })
  }

  const saveLogin = async (event) => {
    event.preventDefault()
    const next = {}
    const normalised = normalisePhone(loginForm.phone)
    if (loginModal.mode === 'create') {
      if (!loginForm.full_name.trim()) next.full_name = 'Enter the resident name.'
      if (!isValidPhone(normalised)) next.phone = 'Enter a complete phone number.'
    }
    if (loginForm.password.trim().length < 8) next.password = 'Use at least 8 characters.'
    setLoginErrors(next)
    if (Object.keys(next).length) return

    setLoginSaving(true)
    try {
      if (loginModal.mode === 'create') {
        await repo.profiles.createResidentLogin({
          fullName: loginForm.full_name,
          phone: normalised,
          password: loginForm.password,
          apartmentId: aptModal.apartment.id,
        })
        toast.success(`Login created for ${normalised}. Give the password to the resident.`)
        setAptModal({ open: false, apartment: null })
      } else {
        await repo.profiles.resetPassword(loginModal.resident.id, loginForm.password)
        toast.success('Password changed. Give the new password to the resident.')
      }
      setLoginModal({ open: false, mode: 'create', resident: null })
      reload()
    } catch (err) {
      setLoginErrors({ form: err.message })
    } finally {
      setLoginSaving(false)
    }
  }

  const saveBlock = async (event) => {    event.preventDefault()
    const block = blockForm.block.trim()
    const count = Number(blockForm.count)
    const start = Number(blockForm.start)
    if (!block) {
      toast.error('Enter a block name, for example A or T.')
      return
    }
    if (!Number.isInteger(count) || count < 1 || count > 40) {
      toast.error('Number of apartments must be between 1 and 40.')
      return
    }
    if (!Number.isInteger(start) || start < 0) {
      toast.error('Enter a valid starting number.')
      return
    }
    setBlockSaving(true)
    try {
      const rows = Array.from({ length: count }, (_, index) => ({
        block,
        unit_number: String(start + index),
        display_label: `${block}${start + index}`,
        maintenance_amount: Number(blockForm.amount) || 0,
      }))
      await repo.apartments.bulkCreate(rows)
      toast.success(`${count} apartments added to Block ${block}.`)
      setBlockOpen(false)
      setBlockForm({ block: '', count: '6', start: '1', amount: '2500' })
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not add the block.')
    } finally {
      setBlockSaving(false)
    }
  }

  const openCombined = (group = null) => {
    const locked = group ? payments.some((payment) => payment.combined_id === group.id) : false
    setCombinedForm({
      name: group?.name || '',
      maintenance_amount: group ? String(group.maintenance_amount ?? '') : '',
      notes: group?.notes || '',
      apartment_ids: group?.apartment_ids || [],
    })
    setCombinedErrors({})
    setCombinedSearch('')
    setCombinedModal({ open: true, group: group || null, locked })
  }

  const combinedEligible = useMemo(() => {
    const editingId = combinedModal.group?.id
    const blocked = new Set(
      combined
        .filter((group) => group.is_active && group.id !== editingId)
        .flatMap((group) => group.apartment_ids || []),
    )
    return apartments.filter(
      (apartment) =>
        apartment.is_active &&
        (!blocked.has(apartment.id) || combinedModal.group?.apartment_ids?.includes(apartment.id)),
    )
  }, [apartments, combined, combinedModal.group])

  const filteredCombinedEligible = useMemo(() => {
    const query = combinedSearch.trim().toLowerCase()
    return combinedEligible.filter((apartment) => {
      if (!query) return true
      return [labelOf(apartment), apartment.resident_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [combinedEligible, combinedSearch])

  const toggleCombinedMember = (id) => {
    if (combinedModal.locked) return
    setCombinedForm((current) => ({
      ...current,
      apartment_ids: current.apartment_ids.includes(id)
        ? current.apartment_ids.filter((value) => value !== id)
        : [...current.apartment_ids, id],
    }))
    setCombinedErrors((current) => ({ ...current, apartment_ids: undefined }))
  }

  const saveCombined = async (event) => {
    event.preventDefault()
    const next = {}
    if (combinedForm.apartment_ids.length < 2) {
      next.apartment_ids = 'Select at least two apartments to combine.'
    }
    if (!(Number(combinedForm.maintenance_amount) >= 0)) {
      next.maintenance_amount = 'Enter the shared monthly maintenance amount.'
    }
    setCombinedErrors(next)
    if (Object.keys(next).length) return
    setCombinedSaving(true)
    try {
      if (combinedModal.group) {
        await repo.combined.update(combinedModal.group.id, {
          name: combinedForm.name,
          maintenance_amount: Number(combinedForm.maintenance_amount),
          notes: combinedForm.notes,
          ...(combinedModal.locked ? {} : { apartment_ids: combinedForm.apartment_ids }),
        })
        toast.success('Combined unit updated.')
      } else {
        await repo.combined.create({
          name: combinedForm.name,
          maintenance_amount: Number(combinedForm.maintenance_amount),
          apartment_ids: combinedForm.apartment_ids,
          notes: combinedForm.notes,
        })
        toast.success('Apartments combined into one maintenance unit.')
      }
      setCombinedModal({ open: false, group: null, locked: false })
      reload()
    } catch (err) {
      setCombinedErrors({ form: err.message })
    } finally {
      setCombinedSaving(false)
    }
  }

  const separate = async () => {
    if (!separateTarget) return
    setSeparating(true)
    try {
      await repo.combined.separate(separateTarget.id)
      toast.success('Combined unit separated. Past receipts are untouched.')
      setSeparateTarget(null)
      reload()
    } catch (err) {
      toast.error(err.message || 'Could not separate the units.')
    } finally {
      setSeparating(false)
    }
  }

  useEffect(() => {
    if (!combinedModal.open) setCombinedSearch('')
  }, [combinedModal.open])

  if (loading && !data) return <PageSkeleton />
  if (error && !data) return <InlineError message={error.message} onRetry={reload} />

  const selectedMembers = combinedForm.apartment_ids
    .map((id) => apartments.find((apartment) => apartment.id === id))
    .filter(Boolean)

  return (
    <div>
      <PageHeader
        title="Apartment directory"
        description={
          isTreasurer
            ? 'Manage blocks, apartment numbers, residents and combined maintenance units.'
            : 'Review blocks, apartments, residents and combined maintenance units. Only the treasurer can make changes.'
        }
        action={
          isTreasurer ? (
            <div className="flex flex-wrap gap-2">
              <Button size="md" variant="secondary" icon={Building2} onClick={() => setBlockOpen(true)}>
                Add block
              </Button>
              <Button size="md" variant="soft" icon={Layers} onClick={() => openCombined()}>
                Combine
              </Button>
              <Button size="md" icon={Plus} onClick={openAddApartment}>
                Add apartment
              </Button>
            </div>
          ) : null
        }
      />

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search apartment, resident or phone"
              aria-label="Search apartments"
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[1rem] text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
          </div>
          <Select
            name="blockFilter"
            label="Block"
            value={blockFilter}
            onChange={(event) => setBlockFilter(event.target.value)}
            options={[
              { value: 'all', label: 'All blocks' },
              ...blocks.map((block) => ({ value: block, label: `Block ${block}` })),
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Building2 className="h-4 w-4" />
            {filteredApartments.length} apartments in {blocks.length} blocks
          </p>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-600"
            />
            Show inactive apartments
          </label>
        </div>
      </Card>

      {activeCombined.length > 0 ? (
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[1.15rem] font-bold text-slate-900">Combined units</h2>
              <p className="text-sm text-slate-500">
                One maintenance record, one payment status and one receipt per combined unit.
              </p>
            </div>
            {isTreasurer ? (
              <Button size="sm" variant="soft" icon={Plus} onClick={() => openCombined()}>
                New combined unit
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeCombined.map((group) => {
              const members = (group.apartment_ids || [])
                .map((id) => apartments.find((apartment) => apartment.id === id))
                .filter(Boolean)
              const hasPayments = payments.some((payment) => payment.combined_id === group.id)
              return (
                <Card key={group.id} className="border-grape-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grape-50 text-grape-600">
                        <Layers className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-[1.05rem] font-semibold text-slate-900">{group.name}</h3>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {members.map(labelOf).join(' + ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[1.05rem] font-bold text-slate-900">
                        {money(group.maintenance_amount)}
                      </p>
                      <p className="text-xs text-slate-500">per month</p>
                    </div>
                  </div>
                  {group.notes ? (
                    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{group.notes}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill tone="grape">{members.length} apartments</Pill>
                    <Pill tone={hasPayments ? 'emerald' : 'slate'}>
                      {hasPayments ? 'Payment history kept' : 'No payments yet'}
                    </Pill>
                    {isTreasurer ? (
                      <div className="ml-auto flex gap-1">
                        <button
                          type="button"
                          onClick={() => openCombined(group)}
                          className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setSeparateTarget(group)}
                          className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                        >
                          <Split className="h-4 w-4" /> Separate
                        </button>
                      </div>
                    ) : null}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        <Card className="mb-6 border-dashed">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-grape-50 text-grape-600">
                <Layers className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-[1.05rem] font-semibold text-slate-900">Combined apartments</h2>
                <p className="mt-0.5 max-w-xl text-sm leading-relaxed text-slate-500">
                  Combine two or more apartments (for example A2 + T2) into one shared maintenance unit.
                  Duplicate maintenance is prevented automatically.
                </p>
              </div>
            </div>
            {isTreasurer ? (
              <Button size="md" variant="soft" icon={Layers} onClick={() => openCombined()}>
                Combine apartments
              </Button>
            ) : null}
          </div>
        </Card>
      )}

      {groupedByBlock.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No apartments found"
            description={
              apartments.length === 0
                ? isTreasurer
                  ? 'Add a block or an individual apartment to start the directory.'
                  : 'The treasurer has not added any apartments yet.'
                : 'No apartments match this search or block filter.'
            }
            action={
              isTreasurer ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="md" variant="secondary" icon={Building2} onClick={() => setBlockOpen(true)}>
                    Add block
                  </Button>
                  <Button size="md" icon={Plus} onClick={openAddApartment}>
                    Add apartment
                  </Button>
                </div>
              ) : null
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByBlock.map(([block, blockApartments]) => (
            <section key={block}>
              <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
                <h2 className="text-[1.1rem] font-bold text-slate-900">Block {block}</h2>
                <p className="text-sm text-slate-500">{blockApartments.length} apartments</p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {blockApartments
                  .slice()
                  .sort((a, b) => String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true }))
                  .map((apartment) => {
                    const group = groupedMap.get(apartment.id)
                    const linkedResident = apartment.user_id ? residentById.get(apartment.user_id) : null
                    return (
                      <div
                        key={apartment.id}
                        className={cn(
                          'rounded-2xl border border-slate-100 bg-white p-4 shadow-soft',
                          !apartment.is_active && 'opacity-60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-[0.92rem] font-bold text-brand-700">
                              {labelOf(apartment)}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[0.98rem] font-semibold text-slate-900">
                                {apartment.resident_name || 'Vacant / no resident'}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {OCCUPANCY_LABELS[apartment.occupancy_status] || 'Owner occupied'}
                                {apartment.contact_phone ? ` · ${apartment.contact_phone}` : ''}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {group ? (
                                  <Pill tone="grape">
                                    <Layers className="h-3 w-3" /> {group.name}
                                  </Pill>
                                ) : null}
                                {linkedResident ? (
                                  <Pill tone="emerald">
                                    <Link2 className="h-3 w-3" /> App linked
                                  </Pill>
                                ) : (
                                  <Pill tone="amber">
                                    <Unlink className="h-3 w-3" /> Not linked
                                  </Pill>
                                )}
                                {!apartment.is_active ? <Pill tone="rose">Inactive</Pill> : null}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-right">
                              <p className="text-[0.98rem] font-bold text-slate-900">
                                {money(apartment.maintenance_amount)}
                              </p>
                              <p className="text-xs text-slate-500">per month</p>
                            </div>
                            {isTreasurer ? (
                              <button
                                type="button"
                                onClick={() => openEditApartment(apartment)}
                                className="flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                              >
                                <Pencil className="h-4 w-4" /> Edit
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </section>
          ))}
        </div>
      )}

      {inactiveCombined.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-2 text-[1rem] font-bold text-slate-700">Previously separated units</h2>
          <div className="space-y-2">
            {inactiveCombined.map((group) => (
              <div
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white p-4 opacity-80"
              >
                <p className="text-[0.92rem] font-semibold text-slate-700">{group.name}</p>
                <p className="text-xs text-slate-500">
                  Separated · history and receipts retained
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Apartment form */}
      <Modal
        open={aptModal.open}
        onClose={() => setAptModal({ open: false, apartment: null })}
        title={aptModal.apartment ? 'Edit apartment' : 'Add apartment'}
        description="Configure the apartment, resident contact and monthly maintenance."
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setAptModal({ open: false, apartment: null })}
              disabled={aptSaving}
            >
              Cancel
            </Button>
            <Button type="submit" form="apartment-form" loading={aptSaving}>
              Save apartment
            </Button>
          </div>
        }
      >
        <form id="apartment-form" onSubmit={saveApartment} className="space-y-4" noValidate>
          {aptErrors.form ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {aptErrors.form}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Block"
              name="block"
              placeholder="e.g. A"
              value={aptForm.block}
              onChange={(event) => setAptValue('block', event.target.value)}
              error={aptErrors.block}
              list="block-names"
            />
            <datalist id="block-names">
              {blocks.map((block) => (
                <option key={block} value={block} />
              ))}
            </datalist>
            <Input
              label="Apartment number"
              name="unit_number"
              placeholder="e.g. 3"
              value={aptForm.unit_number}
              onChange={(event) => setAptValue('unit_number', event.target.value)}
              error={aptErrors.unit_number}
            />
          </div>
          <Input
            label="Display label"
            name="display_label"
            placeholder="Auto: A3"
            optional
            value={aptForm.display_label}
            onChange={(event) => setAptValue('display_label', event.target.value)}
            hint="The short label residents see, e.g. A3 or BB."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Resident name"
              name="resident_name"
              placeholder="Full name"
              value={aptForm.resident_name}
              onChange={(event) => setAptValue('resident_name', event.target.value)}
            />
            <Input
              label="Contact phone"
              name="contact_phone"
              type="tel"
              placeholder="+91 98400 00000"
              value={aptForm.contact_phone}
              onChange={(event) => setAptValue('contact_phone', event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Occupancy"
              name="occupancy_status"
              value={aptForm.occupancy_status}
              onChange={(event) => setAptValue('occupancy_status', event.target.value)}
              options={OCCUPANCY_OPTIONS}
            />
            <Input
              label="Monthly maintenance"
              name="maintenance_amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              prefix="₹"
              value={aptForm.maintenance_amount}
              onChange={(event) => setAptValue('maintenance_amount', event.target.value)}
              error={aptErrors.maintenance_amount}
            />
          </div>
          <Select
            label="Linked resident account"
            name="user_id"
            value={aptForm.user_id}
            onChange={(event) => setAptValue('user_id', event.target.value)}
            options={[
              { value: '', label: 'Not linked' },
              ...residents.map((resident) => ({
                value: resident.id,
                label: `${resident.full_name} · ${resident.phone || 'No phone number'}`,
              })),
            ]}
            hint="Create this flat's login below, or link an existing resident account."
          />
          <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
                <KeyRound className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-semibold text-slate-900">Resident app login</p>
                {aptModal.apartment ? (
                  linkedLogin ? (
                    <>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                        Sign-in phone{' '}
                        <strong className="font-semibold text-slate-900">
                          {linkedLogin.phone || 'not set'}
                        </strong>{' '}
                        · password set by the committee
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2.5"
                        icon={KeyRound}
                        onClick={() => openResetLogin(linkedLogin)}
                      >
                        Reset password
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                        No login yet. Create a phone number and password, then hand them to the
                        resident.
                      </p>
                      <Button size="sm" className="mt-2.5" icon={KeyRound} onClick={openCreateLogin}>
                        Create login
                      </Button>
                    </>
                  )
                ) : (
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                    Save the apartment first, then create its resident login here.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <Checkbox
              label="Active for maintenance billing"
              description={
                groupedMap.get(aptModal.apartment?.id)
                  ? `This apartment is part of ${groupedMap.get(aptModal.apartment?.id)?.name}. Separate the combined unit before marking it inactive.`
                  : 'Inactive apartments are kept in the directory but excluded from billing.'
              }
              checked={aptForm.is_active}
              disabled={Boolean(groupedMap.get(aptModal.apartment?.id))}
              onChange={(event) => setAptValue('is_active', event.target.checked)}
            />
          </div>
          {aptModal.apartment ? (
            <p className="text-xs text-slate-400">
              Added {formatDate(aptModal.apartment.created_at)} · ID {String(aptModal.apartment.id).slice(0, 8)}
            </p>
          ) : null}
        </form>
      </Modal>

      {/* Resident login form */}
      <Modal
        open={loginModal.open}
        onClose={() => setLoginModal({ open: false, mode: 'create', resident: null })}
        title={loginModal.mode === 'create' ? 'Create resident login' : 'Reset resident password'}
        description={
          loginModal.mode === 'create'
            ? 'The resident signs in with this phone number and password, just like the committee.'
            : 'Choose a new password and give it to the resident. Their old password stops working immediately.'
        }
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setLoginModal({ open: false, mode: 'create', resident: null })}
              disabled={loginSaving}
            >
              Cancel
            </Button>
            <Button type="submit" form="resident-login-form" icon={KeyRound} loading={loginSaving}>
              {loginModal.mode === 'create' ? 'Create login' : 'Save new password'}
            </Button>
          </div>
        }
      >
        <form id="resident-login-form" onSubmit={saveLogin} className="space-y-4" noValidate>
          {loginErrors.form ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {loginErrors.form}
            </div>
          ) : null}
          {loginModal.mode === 'create' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Resident name"
                name="login_full_name"
                placeholder="Full name"
                value={loginForm.full_name}
                onChange={(event) => {
                  setLoginForm((current) => ({ ...current, full_name: event.target.value }))
                  setLoginErrors((current) => ({ ...current, full_name: undefined }))
                }}
                error={loginErrors.full_name}
              />
              <Input
                label="Sign-in phone"
                name="login_phone"
                type="tel"
                placeholder="+91 98400 00000"
                value={loginForm.phone}
                onChange={(event) => {
                  setLoginForm((current) => ({ ...current, phone: event.target.value }))
                  setLoginErrors((current) => ({ ...current, phone: undefined }))
                }}
                error={loginErrors.phone}
              />
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {loginModal.resident?.full_name} · {loginModal.resident?.phone || 'No phone number'}
            </div>
          )}
          <div>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  label="Password"
                  name="login_password"
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
              At least 8 characters. Write it down before saving — the resident will need it to open
              the app.
            </p>
          </div>
        </form>
      </Modal>

      {/* Block bulk form */}
      <Modal
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title="Add a block"
        description="Create several numbered apartments at once. You can edit each one later."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setBlockOpen(false)} disabled={blockSaving}>
              Cancel
            </Button>
            <Button type="submit" form="block-form" loading={blockSaving}>
              Create apartments
            </Button>
          </div>
        }
      >
        <form id="block-form" onSubmit={saveBlock} className="space-y-4" noValidate>
          <Input
            label="Block name"
            name="block"
            placeholder="e.g. A"
            value={blockForm.block}
            onChange={(event) => setBlockForm((current) => ({ ...current, block: event.target.value }))}
            hint="For example A, B, C or T."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Number of apartments"
              name="count"
              type="number"
              min="1"
              max="40"
              value={blockForm.count}
              onChange={(event) => setBlockForm((current) => ({ ...current, count: event.target.value }))}
            />
            <Input
              label="Start at number"
              name="start"
              type="number"
              min="0"
              value={blockForm.start}
              onChange={(event) => setBlockForm((current) => ({ ...current, start: event.target.value }))}
            />
          </div>
          <Input
            label="Maintenance per apartment"
            name="amount"
            type="number"
            min="0"
            prefix="₹"
            value={blockForm.amount}
            onChange={(event) => setBlockForm((current) => ({ ...current, amount: event.target.value }))}
          />
          <div className="rounded-2xl bg-brand-50 p-4 text-[0.9rem] leading-relaxed text-brand-800">
            Preview:{' '}
            {blockForm.block
              ? `${Array.from({ length: Math.min(Number(blockForm.count) || 0, 5) }, (_, index) => `${blockForm.block}${(Number(blockForm.start) || 0) + index}`).join(', ')}${Number(blockForm.count) > 5 ? ` … (${blockForm.count} apartments)` : ''}`
              : 'Enter a block name to preview the labels.'}
          </div>
        </form>
      </Modal>

      {/* Combined unit form */}
      <Modal
        open={combinedModal.open}
        onClose={() => setCombinedModal({ open: false, group: null, locked: false })}
        title={combinedModal.group ? 'Edit combined unit' : 'Combine apartments'}
        description="The selected apartments share one maintenance amount, one payment status and one receipt."
        size="lg"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setCombinedModal({ open: false, group: null, locked: false })}
              disabled={combinedSaving}
            >
              Cancel
            </Button>
            <Button type="submit" form="combined-form" icon={Layers} loading={combinedSaving}>
              {combinedModal.group ? 'Save combined unit' : 'Create combined unit'}
            </Button>
          </div>
        }
      >
        <form id="combined-form" onSubmit={saveCombined} className="space-y-4" noValidate>
          {combinedErrors.form ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {combinedErrors.form}
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Unit name"
              name="name"
              placeholder="e.g. A2 + T2"
              optional
              value={combinedForm.name}
              onChange={(event) => setCombinedForm((current) => ({ ...current, name: event.target.value }))}
              hint="Leave blank to use the apartment labels."
            />
            <Input
              label="Shared monthly maintenance"
              name="maintenance_amount"
              type="number"
              min="0"
              step="1"
              prefix="₹"
              value={combinedForm.maintenance_amount}
              onChange={(event) =>
                setCombinedForm((current) => ({ ...current, maintenance_amount: event.target.value }))
              }
              error={combinedErrors.maintenance_amount}
            />
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.95rem] font-medium text-slate-700">
                Apartments in this unit
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {combinedForm.apartment_ids.length} selected
                </span>
              </p>
              {combinedModal.locked ? (
                <Pill tone="amber">Members locked — payments exist</Pill>
              ) : null}
            </div>
            {combinedErrors.apartment_ids ? (
              <p className="mb-2 text-sm font-medium text-rose-600">{combinedErrors.apartment_ids}</p>
            ) : null}
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={combinedSearch}
                onChange={(event) => setCombinedSearch(event.target.value)}
                placeholder="Search apartments"
                aria-label="Search apartments to combine"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-[0.95rem] focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </div>
            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-100 p-2">
              {filteredCombinedEligible.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-500">
                  No available apartments. Separate an existing combined unit to reuse its members.
                </p>
              ) : (
                filteredCombinedEligible.map((apartment) => {
                  const selected = combinedForm.apartment_ids.includes(apartment.id)
                  return (
                    <button
                      key={apartment.id}
                      type="button"
                      onClick={() => toggleCombinedMember(apartment.id)}
                      disabled={combinedModal.locked}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition',
                        selected
                          ? 'border-grape-200 bg-grape-50/60'
                          : 'border-transparent hover:bg-slate-50',
                        combinedModal.locked && 'opacity-60',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                          selected
                            ? 'border-grape-500 bg-grape-600 text-white'
                            : 'border-slate-300 bg-white',
                        )}
                      >
                        {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.95rem] font-semibold text-slate-900">
                          {labelOf(apartment)}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {apartment.resident_name || 'Vacant'} · {money(apartment.maintenance_amount)}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
            {selectedMembers.length > 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Selected: {selectedMembers.map(labelOf).join(' + ')}
              </p>
            ) : null}
          </div>

          <TextArea
            label="Notes"
            name="notes"
            optional
            rows={2}
            placeholder="Optional note about this combined unit"
            value={combinedForm.notes}
            onChange={(event) => setCombinedForm((current) => ({ ...current, notes: event.target.value }))}
          />

          {combinedModal.group && combinedModal.locked ? (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[0.85rem] leading-relaxed text-amber-900">
              This combined unit already has payment records, so its members cannot be changed. You can
              update its name, amount and notes, or separate it and create a new combined unit.
            </div>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(separateTarget)}
        onClose={() => setSeparateTarget(null)}
        onConfirm={separate}
        title="Separate combined unit?"
        description={
          separateTarget
            ? `${separateTarget.name} will return to individual apartments. Existing payments and receipts for the combined unit are kept unchanged for history.`
            : ''
        }
        confirmLabel="Separate units"
        loading={separating}
      >
        <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
          From the next payment onward, each apartment will be billed separately at its own maintenance
          amount.
        </div>
      </ConfirmDialog>
    </div>
  )
}
