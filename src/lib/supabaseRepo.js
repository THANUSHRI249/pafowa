import { supabase } from './supabase'
import { paymentInsertFromPayload } from './billing'
import { OFFICER_ROLES } from './config'
import {
  RESIDENT_LOGIN_DOMAIN,
  clearSession,
  isValidPhone,
  normalisePhone,
  residentLoginEmail,
} from './security'
import { addMonths } from './utils'

function fail(error, fallback) {
  if (error?.code === '23505') {
    throw new Error('A record for this unit and month already exists. Refresh the list and try again.')
  }
  throw new Error(error?.message || fallback || 'Something went wrong. Please try again.')
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) throw new Error('Please sign in again.')
  return data.user
}

async function fetchProfile(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) fail(error, 'Could not load your profile.')
  if (data) return data

  // Safety net if the signup trigger has not created the profile yet.
  const { data: authData } = await supabase.auth.getUser()
  if (authData?.user?.id !== id) throw new Error('Please sign in again.')
  const loginEmail = authData.user.email || ''
  const fallback = {
    id,
    email: loginEmail.endsWith(`@${RESIDENT_LOGIN_DOMAIN}`) ? null : loginEmail || null,
    full_name: authData.user.user_metadata?.full_name || 'Resident',
    phone: authData.user.user_metadata?.phone || authData.user.phone || '',
    role: 'resident',
  }
  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert(fallback)
    .select()
    .single()
  if (insertError) {
    throw new Error('Your profile is not ready yet. Please sign out and sign in again.')
  }
  return inserted
}

function sortApartments(rows) {
  return [...rows].sort(
    (a, b) =>
      String(a.block).localeCompare(String(b.block)) ||
      String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true }),
  )
}

export const supabaseRepo = {
  mode: 'supabase',

  auth: {
    async getSession() {
      const { data } = await supabase.auth.getSession()
      if (!data?.session) return null
      return fetchProfile(data.session.user.id)
    },
    async signIn(phone, password) {
      const normalised = normalisePhone(phone)
      if (!isValidPhone(normalised)) throw new Error('Enter a valid phone number.')
      if (!password) throw new Error('Enter your password.')
      const { data, error } = await supabase.auth.signInWithPassword({
        email: residentLoginEmail(normalised),
        password,
      })
      if (error) {
        if (/invalid login credentials|invalid email or password/i.test(error.message || '')) {
          throw new Error(
            'That phone number and password do not match. Ask the committee to reset your password.',
          )
        }
        throw new Error(error.message || 'Could not sign in.')
      }
      return fetchProfile(data.user.id)
    },
    async registerLogin({ deviceHash = '', platform = '', userAgent = '' } = {}) {
      const { data, error } = await supabase.rpc('register_login', {
        p_device_hash: deviceHash,
        p_platform: platform,
        p_user_agent: userAgent,
      })
      if (error) throw new Error(error.message || 'Could not register this sign-in.')
      return data
    },
    async signOut() {
      await supabase.auth.signOut()
      clearSession()
    },
    onChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') callback(null)
      })
      return () => data.subscription.unsubscribe()
    },
  },

  profiles: {
    async getMe() {
      const user = await currentUser()
      return fetchProfile(user.id)
    },
    async updateMe(patch) {
      const user = await currentUser()
      const { data, error } = await supabase
        .from('profiles')
        .update({ full_name: patch.full_name, phone: patch.phone })
        .eq('id', user.id)
        .select()
        .single()
      if (error) fail(error, 'Could not save your profile.')
      return data
    },
    async listResidents() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'resident')
        .order('full_name')
      if (error) fail(error, 'Could not load resident accounts.')
      return data
    },
    async createResidentLogin({ fullName, phone, password, apartmentId }) {
      const { data, error } = await supabase.rpc('admin_create_resident_login', {
        p_full_name: String(fullName || '').trim(),
        p_phone: String(phone || '').trim(),
        p_password: password,
        p_apartment_id: apartmentId || null,
      })
      if (error) throw new Error(error.message || 'Could not create the resident login.')
      return data
    },
    async createOfficerLogin({ fullName, phone, password, role }) {
      const { data, error } = await supabase.rpc('admin_create_officer_login', {
        p_full_name: String(fullName || '').trim(),
        p_phone: String(phone || '').trim(),
        p_password: password,
        p_role: role,
      })
      if (error) throw new Error(error.message || 'Could not create the committee login.')
      return data
    },
    async resetPassword(profileId, password) {
      const { error } = await supabase.rpc('admin_reset_password', {
        p_profile_id: profileId,
        p_password: password,
      })
      if (error) throw new Error(error.message || 'Could not reset the password.')
    },
  },

  apartments: {
    async list({ includeArchived = false } = {}) {
      let query = supabase.from('apartments').select('*')
      if (!includeArchived) query = query.eq('is_active', true)
      const { data, error } = await query
      if (error) fail(error, 'Could not load apartments.')
      return sortApartments(data)
    },
    async mine(userId) {
      const { data, error } = await supabase
        .from('apartments')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
      if (error) fail(error, 'Could not load your apartment.')
      return sortApartments(data)
    },
    async create(payload) {
      const row = {
        block: String(payload.block || '').trim(),
        unit_number: String(payload.unit_number || '').trim(),
        display_label:
          String(payload.display_label || '').trim() || `${payload.block}${payload.unit_number}`,
        resident_name: String(payload.resident_name || '').trim(),
        contact_phone: String(payload.contact_phone || '').trim(),
        occupancy_status: payload.occupancy_status || 'owner',
        maintenance_amount: Number(payload.maintenance_amount) || 0,
        user_id: payload.user_id || null,
        is_active: payload.is_active !== false,
      }
      const { data, error } = await supabase.from('apartments').insert(row).select().single()
      if (error) fail(error, 'Could not add the apartment.')
      return data
    },
    async bulkCreate(rows) {
      const { data, error } = await supabase.from('apartments').insert(rows).select()
      if (error) fail(error, 'Could not add the block.')
      return data
    },
    async update(id, patch) {
      const row = { ...patch }
      if ('maintenance_amount' in row) row.maintenance_amount = Number(row.maintenance_amount) || 0
      if ('user_id' in row) row.user_id = row.user_id || null
      const { data, error } = await supabase
        .from('apartments')
        .update(row)
        .eq('id', id)
        .select()
        .single()
      if (error) fail(error, 'Could not save the apartment.')
      return data
    },
    async archive(id) {
      const { data, error } = await supabase
        .from('apartments')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single()
      if (error) fail(error, 'Could not archive the apartment.')
      return data
    },
  },

  combined: {
    async list() {
      const [{ data: groups, error: groupError }, { data: members, error: memberError }] =
        await Promise.all([
          supabase.from('combined_apartments').select('*').order('created_at'),
          supabase.from('combined_apartment_members').select('*'),
        ])
      if (groupError) fail(groupError, 'Could not load combined units.')
      if (memberError) fail(memberError, 'Could not load combined unit members.')
      return (groups || [])
        .map((group) => ({
          ...group,
          apartment_ids: (members || [])
            .filter((m) => m.combined_id === group.id)
            .map((m) => m.apartment_id),
        }))
        .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name))
    },
    async create({ name, maintenance_amount, apartment_ids, notes }) {
      const { data, error } = await supabase.rpc('create_combined_unit', {
        p_name: String(name || '').trim(),
        p_amount: Number(maintenance_amount) || 0,
        p_apartment_ids: apartment_ids,
        p_notes: String(notes || '').trim(),
      })
      if (error) throw new Error(error.message || 'Could not combine these apartments.')
      return { id: data }
    },
    async update(id, patch) {
      const { error } = await supabase.rpc('update_combined_unit', {
        p_combined_id: id,
        p_name: patch.name ?? null,
        p_amount: patch.maintenance_amount ?? null,
        p_apartment_ids: patch.apartment_ids ?? null,
        p_notes: patch.notes ?? null,
      })
      if (error) throw new Error(error.message || 'Could not update the combined unit.')
      return { id }
    },
    async separate(id) {
      const { error } = await supabase.rpc('separate_combined_unit', { p_combined_id: id })
      if (error) throw new Error(error.message || 'Could not separate the combined unit.')
      return { id, is_active: false }
    },
  },

  payments: {
    async list(filters = {}) {
      let query = supabase.from('maintenance_payments').select('*').order('created_at', { ascending: false }).limit(500)
      if (filters.month) query = query.eq('maintenance_month', `${filters.month}-01`)
      if (filters.method) query = query.eq('payment_method', filters.method)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.unitKey) {
        query = filters.unitKey.startsWith('combined:')
          ? query.eq('combined_id', filters.unitKey.slice(9))
          : query.eq('apartment_id', filters.unitKey.slice(10))
      }
      const { data, error } = await query
      if (error) fail(error, 'Could not load payments.')
      let rows = data
      if (filters.search) {
        const q = filters.search.trim().toLowerCase()
        rows = rows.filter((p) =>
          [p.unit_label, p.resident_name, p.receipt_number, p.transaction_id, p.notes]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q)),
        )
      }
      return rows
    },
    async submit(payload) {
      const user = await currentUser()
      const existingQuery = supabase
        .from('maintenance_payments')
        .select('id, status')
        .eq('maintenance_month', `${payload.month}-01`)
        .in('status', ['pending', 'confirmed'])
      const scoped =
        payload.unit.type === 'combined'
          ? existingQuery.eq('combined_id', payload.unit.id)
          : existingQuery.eq('apartment_id', payload.unit.id)
      const { data: existing, error: existingError } = await scoped
      if (existingError) fail(existingError, 'Could not check for an existing payment.')
      if (existing?.length) {
        throw new Error(
          existing[0].status === 'pending'
            ? 'A payment for this unit and month is already waiting for treasurer confirmation.'
            : 'This unit is already marked as paid for the selected month.',
        )
      }
      const row = { ...paymentInsertFromPayload({ id: user.id }, payload), status: 'pending' }
      const { data, error } = await supabase.from('maintenance_payments').insert(row).select().single()
      if (error) fail(error, 'Could not submit the payment.')
      return data
    },
    async record(payload) {
      const user = await currentUser()
      const row = { ...paymentInsertFromPayload({ id: user.id }, payload), status: 'pending' }
      const { data, error } = await supabase
        .from('maintenance_payments')
        .insert(row)
        .select()
        .single()
      if (error) fail(error, 'Could not record the payment.')
      if (!payload.confirm) return { payment: data, receipt: null }

      const { data: receiptData, error: confirmError } = await supabase.rpc('confirm_payment', {
        p_payment_id: data.id,
      })
      if (confirmError) {
        throw new Error(
          'The payment was saved but confirmation failed. Open the Pending tab and confirm it again.',
        )
      }
      const receipt = Array.isArray(receiptData) ? receiptData[0] : receiptData
      const { data: updated } = await supabase
        .from('maintenance_payments')
        .select('*')
        .eq('id', data.id)
        .maybeSingle()
      return { payment: updated || data, receipt }
    },
    async confirm(paymentId) {
      const { data, error } = await supabase.rpc('confirm_payment', { p_payment_id: paymentId })
      if (error) throw new Error(error.message || 'Could not confirm the payment.')
      const receipt = Array.isArray(data) ? data[0] : data
      const { data: payment, error: fetchError } = await supabase
        .from('maintenance_payments')
        .select('*')
        .eq('id', paymentId)
        .maybeSingle()
      if (fetchError) fail(fetchError, 'Payment confirmed, but it could not be reloaded.')
      return { payment, receipt }
    },
    async reject(paymentId, reason) {
      const user = await currentUser()
      const { data, error } = await supabase
        .from('maintenance_payments')
        .update({
          status: 'rejected',
          rejection_reason: String(reason || '').trim() || 'Rejected by treasurer.',
          confirmed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single()
      if (error) fail(error, 'Could not reject the payment.')
      return data
    },
  },

  receipts: {
    async getByPayment(paymentId) {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('payment_id', paymentId)
        .maybeSingle()
      if (error) fail(error, 'Could not load the receipt.')
      return data
    },
    async archivePdf(receipt, blob) {
      if (!receipt?.receipt_number || !blob) return null
      const path = `${receipt.receipt_number}.pdf`
      const { error } = await supabase.storage
        .from('receipts')
        .upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (error) {
        console.warn('Receipt PDF was not archived:', error.message)
        return null
      }
      await supabase.from('receipts').update({ pdf_path: path }).eq('id', receipt.id)
      return path
    },
  },

  security: {
    async overview() {
      const [alerts, devices, events, officers] = await Promise.all([
        supabase
          .from('security_alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('officer_devices')
          .select('*')
          .order('last_seen_at', { ascending: false }),
        supabase
          .from('security_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('profiles')
          .select(
            'id, full_name, role, email, phone, security_locked, security_locked_at, security_locked_reason, last_login_at',
          )
          .in('role', OFFICER_ROLES),
      ])

      const firstError = alerts.error || devices.error || events.error || officers.error
      if (firstError) fail(firstError, 'Could not load the security log.')

      return {
        alerts: alerts.data || [],
        devices: devices.data || [],
        events: events.data || [],
        officers: (officers.data || []).sort(
          (a, b) => OFFICER_ROLES.indexOf(a.role) - OFFICER_ROLES.indexOf(b.role),
        ),
      }
    },
    async acknowledge(alertId) {
      const { error } = await supabase.rpc('acknowledge_alert', { p_alert_id: alertId })
      if (error) throw new Error(error.message || 'Could not acknowledge the alert.')
    },
    async lockOfficer(officerId, reason = '') {
      const { error } = await supabase.rpc('lock_officer', {
        p_officer_id: officerId,
        p_reason: String(reason || '').trim(),
      })
      if (error) throw new Error(error.message || 'Could not lock the account.')
    },
    async unlockOfficer(officerId) {
      const { error } = await supabase.rpc('unlock_officer', { p_officer_id: officerId })
      if (error) throw new Error(error.message || 'Could not unlock the account.')
    },
  },

  expenses: {
    async list({ month, category } = {}) {
      let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false })
      if (month) {
        query = query
          .gte('expense_date', `${month}-01`)
          .lt('expense_date', `${addMonths(month, 1)}-01`)
      }
      if (category) query = query.eq('category', category)
      const { data, error } = await query
      if (error) fail(error, 'Could not load expenses.')
      return data
    },
    async create(payload, file) {
      const user = await currentUser()
      let voucherPath = null
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error('The voucher file must be smaller than 5 MB.')
        const safeName = String(file.name || 'voucher').replace(/[^a-zA-Z0-9._-]/g, '_')
        voucherPath = `${user.id}/${payload.expense_date}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from('vouchers')
          .upload(voucherPath, file, { contentType: file.type || 'application/octet-stream', upsert: false })
        if (uploadError) throw new Error(`Could not upload the voucher: ${uploadError.message}`)
      }
      const row = {
        expense_date: payload.expense_date,
        category: payload.category,
        description: String(payload.description || '').trim(),
        amount: Number(payload.amount) || 0,
        paid_to: String(payload.paid_to || '').trim(),
        payment_method: payload.payment_method || 'cash',
        voucher_available: Boolean(payload.voucher_available || file),
        voucher_path: voucherPath,
        recorded_by: user.id,
      }
      const { data, error } = await supabase.from('expenses').insert(row).select().single()
      if (error) {
        if (voucherPath) await supabase.storage.from('vouchers').remove([voucherPath])
        fail(error, 'Could not save the expense.')
      }
      return data
    },
    async voidExpense(id, reason) {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          is_void: true,
          void_reason: String(reason || '').trim() || 'Voided by treasurer.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) fail(error, 'Could not void the expense.')
      return data
    },
    async voucherUrl(path) {
      if (!path) return null
      const { data, error } = await supabase.storage.from('vouchers').createSignedUrl(path, 300)
      if (error) return null
      return data.signedUrl
    },
  },

  announcements: {
    async list() {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('published_at', { ascending: false })
      if (error) fail(error, 'Could not load announcements.')
      return data
    },
    async create(payload) {
      const user = await currentUser()
      const row = {
        title: String(payload.title || '').trim(),
        category: payload.category || 'general',
        message: String(payload.message || '').trim(),
        is_active: true,
        published_at: new Date().toISOString(),
        created_by: user.id,
      }
      const { data, error } = await supabase.from('announcements').insert(row).select().single()
      if (error) fail(error, 'Could not publish the announcement.')
      return data
    },
    async update(id, patch) {
      const { data, error } = await supabase
        .from('announcements')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) fail(error, 'Could not update the announcement.')
      return data
    },
  },
}
