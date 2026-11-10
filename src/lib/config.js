export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim()
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const APP_NAME = 'PAFOWA'
export const APP_TAGLINE = 'Pargavi Apartments Foundation Committee Association'
export const APP_SHORT_TAGLINE = 'Apartment maintenance, made simple.'

export const OFFICER_ROLES = ['treasurer', 'president', 'secretary']

export const ROLE_LABELS = {
  resident: 'Resident',
  treasurer: 'Treasurer',
  president: 'President',
  secretary: 'Secretary',
}

export const EXPENSE_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Water maintenance',
  'Cleaning',
  'Repairs',
  'General expenses',
  'Other',
]

export const ANNOUNCEMENT_CATEGORIES = [
  { value: 'water', label: 'Water' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'general', label: 'General' },
]

export const OCCUPANCY_OPTIONS = [
  { value: 'owner', label: 'Owner occupied' },
  { value: 'tenant', label: 'Tenanted' },
  { value: 'vacant', label: 'Vacant' },
]
